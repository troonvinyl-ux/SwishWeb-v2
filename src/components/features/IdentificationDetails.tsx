import { IDENTIFICATION_FIELDS, identificationText } from '@/lib/identificationFields';
import { normalizeIdentification } from '@/lib/identificationResult';
interface IdentificationDetailsProps { candidate: Record<string, unknown>; showUnknown?: boolean; }
export default function IdentificationDetails({ candidate, showUnknown = true }: IdentificationDetailsProps) {
  const data = normalizeIdentification(candidate);
  const fields = IDENTIFICATION_FIELDS.filter(field => !['title', 'description', 'condition', 'conditionNotes'].includes(field.key) && (showUnknown || identificationText(data[field.key])));
  return <div className="space-y-4">
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(field => <div key={field.key}><dt className="text-sm text-muted-foreground">{field.label}</dt><dd className="mt-1 break-words leading-relaxed">{identificationText(data[field.key]) ?? 'Unknown — not established'}</dd></div>)}</dl>
    {identificationText(data.description) && <p className="whitespace-pre-line text-muted-foreground leading-relaxed">{String(data.description)}</p>}
    {showUnknown && <p className="text-sm text-muted-foreground leading-relaxed">Only details returned by SWISH are shown. Unknown fields have not been inferred from the title.</p>}
  </div>;
}
