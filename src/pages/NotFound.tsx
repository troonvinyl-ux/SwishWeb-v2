import { useLocation, Link } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="text-6xl font-bold swish-gold mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>404</div>
        <h1 className="text-xl font-semibold mb-2">This web feature is not available</h1>
        <p className="text-muted-foreground text-sm mb-6">
          <code className="bg-secondary px-2 py-1 rounded text-xs">{location.pathname}</code>
        </p>
        <p className="mb-4 text-sm text-muted-foreground">The requested route is not available as a supported SWISH web workflow.</p>
        <Link to="/niches" className="btn-primary inline-flex">Choose a workspace</Link>
      </div>
    </div>
  );
}
