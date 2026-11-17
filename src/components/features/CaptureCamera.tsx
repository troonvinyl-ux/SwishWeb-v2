import type { CaptureSlot } from '@/types/capture';
import SharedCaptureCamera from '@/components/features/SharedCaptureCamera';
interface CaptureCameraProps { slot: CaptureSlot; disabled: boolean; thumbnail?: string; complete?: number; total?: number; onPhoto: (slot: CaptureSlot, file: File) => void; }
export default function CaptureCamera({ slot, disabled, thumbnail, complete = 0, total = 0, onPhoto }: CaptureCameraProps) {
  return <SharedCaptureCamera label={slot.label} detail={`${complete} / ${total} evidence views captured`} disabled={disabled} thumbnail={thumbnail} canReview onPhoto={file => onPhoto(slot, file)} />;
}
