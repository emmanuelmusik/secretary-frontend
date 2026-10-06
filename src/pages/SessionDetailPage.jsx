import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getLocalAudioUrl, shareLocalAudio } from '../lib/localAudio.js';
import { insightToText } from '../lib/clipboard.js';
import CopyButton from '../components/CopyButton.jsx';
import { useI18n, TRANSLATION_LANGUAGES } from '../i18n/index.jsx';

export default function SessionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, langName, formatDateTime } = useI18n();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('transcript'); // transcript | insight | translation | history | audio

  const [analyzingHistory, setAnalyzingHistory] = useState(false);
  const [historyRange, setHistoryRange] = useState('last_20');

  const [generatingInsight, setGeneratingInsight] = useState(false);

  const [translateTarget, setTranslateTarget] = useState('en');
  const [translating, setTranslating] = useState(false);

  const [audioUrl, setAudioUrl] = useState(null);
  const [audioMissing, setAudioMissing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const audioObjectUrl = useRef(null);

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    return () => { if (audioObjectUrl.current) URL.revokeObjectURL(audioObjectUrl.current); };
  }, []);

  async function load() {
    const s = await api.getSession(id);
    setSession(s);
  }

  async function loadAudio() {
    if (!session?.local_audio_path) { setAudioMissing(true); return; }
    const url = await getLocalAudioUrl(session.local_audio_path);
    if (!url) { setAudioMissing(true); return; }
    audioObjectUrl.current = url;
    setAudioUrl(url);
  }

  function openAudioTab() {
    setTab('audio');
    if (!audioUrl && !audioMissing) loadAudio();
  }

  async function handleShareAudio() {
    setSharing(true);
    try {
      await shareLocalAudio(session.local_audio_path, session.name);
    } catch (err) {
      if (err?.message !== 'Share canceled') alert(err.message || t('audio.share_failed'));
    } finally {
      setSharing(false);
    }
  }

  async function handleAnalyzeWithHistory() {
    setAnalyzingHistory(true);
    try {
      const updated = await api.analyzeWithHistory(id, historyRange);
      setSession(updated);
      setTab('history');
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalyzingHistory(false);
    }
  }

  async function handleGenerateInsight() {
    setGeneratingInsight(true);
    try {
      const updated = await api.generateInsight(id);
      setSession(updated);
      setTab('insight');
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingInsight(false);
    }
  }

  async function handleTranslate() {
    setTranslating(true);
    try {
      const updated = await api.translateSession(id, translateTarget);
      setSession(updated);
      setTab('translation');
    } catch (err) {
      alert(err.message);
    } finally {
      setTranslating(false);
    }
  }

  async function handleDeleteSession() {
    if (!confirm(t('session.delete_confirm'))) return;
    await api.deleteSession(id);
    navigate('/');
  }

  if (!session) return <div className="loading-screen">{t('common.loading')}</div>;

  return (
    <div className="session-detail">
      <div className="session-detail-header">
        <h1>{session.name}</h1>
        <button className="danger-btn-sm" onClick={handleDeleteSession}>{t('common.delete')}</button>
      </div>
      <p className="meta">
        {formatDateTime(session.created_at)} · {formatDuration(session.duration_seconds, t)}
        {session.source_language && ` · ${t('session.detected', { lang: session.source_language })}`}
      </p>

      <div className="tabs">
        <button className={tab === 'transcript' ? 'active' : ''} onClick={() => setTab('transcript')}>{t('tab.transcript')}</button>
        <button className={tab === 'insight' ? 'active' : ''} onClick={() => setTab('insight')}>{t('tab.insight')}</button>
        <button className={tab === 'translation' ? 'active' : ''} onClick={() => setTab('translation')}>{t('tab.translation')}</button>
        {session.history_analysis && <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>{t('tab.history')}</button>}
        <button className={tab === 'audio' ? 'active' : ''} onClick={openAudioTab}>{t('tab.audio')}</button>
      </div>

      {tab === 'transcript' && (
        <div className="copyable">
          <div className="copy-row">
            <CopyButton text={session.raw_transcript} label={t('copy.transcript')} />
          </div>
          <pre className="transcript">{session.raw_transcript}</pre>
        </div>
      )}

      {tab === 'audio' && (
        <div className="audio-panel">
          {audioUrl && (
            <>
              <audio controls src={audioUrl} style={{ width: '100%' }} />
              <button className="share-btn" onClick={handleShareAudio} disabled={sharing}>
                {sharing ? t('audio.preparing') : t('audio.share')}
              </button>
            </>
          )}
          {!audioUrl && audioMissing && (
            <p className="meta">{t('audio.missing')}</p>
          )}
          {!audioUrl && !audioMissing && <p className="meta">{t('audio.loading')}</p>}
        </div>
      )}

      {tab === 'insight' && (
        <div className="analysis">
          {!session.analysis && (
            <div className="empty-panel">
              <p className="meta">{t('insight.none')}</p>
              <button onClick={handleGenerateInsight} disabled={generatingInsight}>
                {generatingInsight ? t('insight.generating') : t('insight.generate')}
              </button>
            </div>
          )}
          {session.analysis && (
            <>
              <div className="insight-header">
                <CopyButton text={() => insightToText(session.analysis, t)} label={t('copy.insight')} />
                <button onClick={handleGenerateInsight} disabled={generatingInsight}>
                  {generatingInsight ? t('insight.regenerating') : t('insight.regenerate')}
                </button>
              </div>
              <h3>{t('insight.summary')}</h3>
              <p>{session.analysis.summary}</p>
              <h3>{t('insight.key_points')}</h3>
              <ul>{session.analysis.key_points?.map((p, i) => <li key={i}>{p}</li>)}</ul>
              <h3>{t('insight.action_items')}</h3>
              <ul>{session.analysis.action_items?.map((a, i) => <li key={i}>{a.item} {a.owner && `— ${a.owner}`}</li>)}</ul>
              <h3>{t('insight.decisions')}</h3>
              <ul>{session.analysis.decisions?.map((d, i) => <li key={i}>{d}</li>)}</ul>
              {session.analysis.quotes?.length > 0 && (
                <>
                  <h3>{t('insight.quotes')}</h3>
                  <div className="quote-list">
                    {session.analysis.quotes.map((q, i) => (
                      <blockquote className="quote-card" key={i}>
                        <p>“{q.quote}”</p>
                        <div className="quote-foot">
                          <span className="quote-speaker">{q.speaker ? `— ${q.speaker}` : ''}</span>
                          <CopyButton
                            text={`"${q.quote}"${q.speaker ? ` — ${q.speaker}` : ''}`}
                            label={t('copy.quote')}
                          />
                        </div>
                      </blockquote>
                    ))}
                  </div>
                </>
              )}
              <h3>{t('insight.questions')}</h3>
              <ul>{session.analysis.questions_raised?.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {tab === 'translation' && (
        <div>
          <div className="translate-controls">
            <select value={translateTarget} onChange={(e) => setTranslateTarget(e.target.value)}>
              {TRANSLATION_LANGUAGES.map((c) => (
                <option key={c} value={c}>{langName(c)}</option>
              ))}
            </select>
            <button onClick={handleTranslate} disabled={translating}>
              {translating ? t('translation.translating') : t('translation.translate')}
            </button>
          </div>
          {session.translated_transcript ? (
            <>
              <div className="copy-row">
                <CopyButton text={session.translated_transcript} label={t('copy.translation')} />
              </div>
              <pre className="transcript">{session.translated_transcript}</pre>
              <div className="copy-row original-row">
                <p className="original-label">{t('translation.original', { lang: session.source_language || t('translation.original_default') })}</p>
                <CopyButton text={session.raw_transcript} label={t('copy.original')} />
              </div>
              <pre className="transcript original-transcript">{session.raw_transcript}</pre>
            </>
          ) : (
            <p className="meta">{t('translation.hint')}</p>
          )}
        </div>
      )}

      {tab === 'history' && session.history_analysis && (
        <div className="analysis">
          <div className="insight-header">
            <CopyButton text={() => historyToText(session.history_analysis, t)} label={t('copy.history')} />
          </div>
          <h3>{t('history.themes')}</h3>
          <ul>{session.history_analysis.recurring_themes?.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <h3>{t('history.progress')}</h3>
          <p>{session.history_analysis.progress_notes}</p>
          <h3>{t('history.outstanding')}</h3>
          <ul>{session.history_analysis.outstanding_action_items?.map((a, i) => <li key={i}>{a}</li>)}</ul>
          <h3>{t('history.patterns')}</h3>
          <p>{session.history_analysis.pattern_observations}</p>
        </div>
      )}

      {session.folder_id && (
        <div className="history-analysis-trigger">
          <select value={historyRange} onChange={(e) => setHistoryRange(e.target.value)}>
            <option value="last_5">{t('history.last5')}</option>
            <option value="last_20">{t('history.last20')}</option>
            <option value="all">{t('history.all')}</option>
          </select>
          <button onClick={handleAnalyzeWithHistory} disabled={analyzingHistory}>
            {analyzingHistory ? t('history.analyzing') : t('history.analyze')}
          </button>
        </div>
      )}
    </div>
  );
}

function historyToText(h, t) {
  if (!h) return '';
  const list = (items) => (items || []).map((x) => `- ${x}`).join('\n');
  return [
    `${t('history.themes').toUpperCase()}\n${list(h.recurring_themes)}`,
    `${t('history.progress').toUpperCase()}\n${h.progress_notes || ''}`,
    `${t('history.outstanding').toUpperCase()}\n${list(h.outstanding_action_items)}`,
    `${t('history.patterns').toUpperCase()}\n${h.pattern_observations || ''}`,
  ].join('\n\n');
}

function formatDuration(seconds, t) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? t('duration.hm', { h, m }) : t('duration.m', { m });
}
