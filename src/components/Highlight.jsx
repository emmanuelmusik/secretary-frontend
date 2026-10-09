import { highlightParts } from '../lib/search.js';

// Shows `text` with the words the person typed picked out.
export default function Highlight({ text, query }) {
  return highlightParts(text, query).map((p, i) => (p.hit ? <mark key={i} className="search-hit">{p.text}</mark> : p.text));
}
