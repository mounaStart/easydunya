import { useTranslation } from "react-i18next";
import type { BookingStatus, TripStatus } from "../lib/types";

interface Props {
  status: BookingStatus | TripStatus;
  kind?: "booking" | "trip";
}

export default function StatusBadge({ status, kind = "booking" }: Props) {
  const { t } = useTranslation();
  const label =
    kind === "trip"
      ? t(`trip.status.${status as TripStatus}`)
      : t(`booking.status.${status as BookingStatus}`);

  const cls =
    status === "confirmed"
      ? "badge-confirmed"
      : status === "pending"
      ? "badge-pending"
      : status === "rejected"
      ? "badge-rejected"
      : status === "completed"
      ? "badge-completed"
      : "badge-cancelled";

  return <span className={cls}>{label}</span>;
}
