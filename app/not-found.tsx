import Link from '../components/site-link';
import LocalizedContent from '../components/localized-content';
export default function NotFound(){return <LocalizedContent><main className="empty-state" style={{minHeight:'100dvh'}}><h1>Not found.</h1><Link href="/app">Open agent</Link></main></LocalizedContent>;}
