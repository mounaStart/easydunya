import { useTranslation } from "react-i18next";
import type { BookingStatus, DriverStatus, TripStatus } from "../lib/types";
import { labelDriverStatus } from "../lib/statusLabels";

interface Props {
  status: BookingStatus | TripStatus | DriverStatus;
  kind?: "booking" | "trip" | "driver";
}

export default function StatusBadge({ status, kind = "booking" }: Props) {
  const { t } = useTranslation();
  const label =
    kind === "trip"
      ? t(`trip.status.${status as TripStatus}`)
      : kind === "driver"
        ? labelDriverStatus(status as DriverStatus, t)
        : t(`booking.status.${status as BookingStatus}`);

  const cls =
    kind === "driver"
      ? status === "approved"
        ? "badge-confirmed"
        : status === "pending"
          ? "badge-pending"
          : status === "rejected"
            ? "badge-rejected"
            : "badge-cancelled"
      : status === "confirmed"
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
