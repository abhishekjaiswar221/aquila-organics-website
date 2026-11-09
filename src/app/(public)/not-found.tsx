import { NotFoundContent } from "@/components/layout/not-found-content";

// notFound() thrown inside the public route group (rendered within its layout).
export default function NotFound() {
  return <NotFoundContent />;
}
