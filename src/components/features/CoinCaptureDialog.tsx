import SharedCaptureCamera from '@/components/features/SharedCaptureCamera';
interface CoinCaptureDialogProps { side: string; onPhoto: (file: File) => void; onClose: () => void; }
export default function CoinCaptureDialog({ side, onPhoto, onClose }: CoinCaptureDialogProps) {
  const name = side === 'obverse' ? 'obverse (front)' : side === 'reverse' ? 'reverse (back)' : side;
  return <SharedCaptureCamera label={`Capture ${name}`} detail="Move back until sharp, then zoom to fill the frame." disabled={false} autoStart coin={side === 'obverse' || side === 'reverse'} canReview={false} onClose={onClose} onPhoto={file => { onPhoto(file); onClose(); }} />;
}
