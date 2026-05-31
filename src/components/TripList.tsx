import type { TripPublic } from "../lib/types";
import TripCard from "./TripCard";
import Spinner from "./Spinner";
import { useTranslation } from "react-i18next";

interface Props {
  trips: TripPublic[];
  loading?: boolean;
}

export default function TripList({ trips, loading }: Props) {
  const { t } = useTranslation();
  if (loading) return <Spinner label={t("common.loading")} />;
  if (trips.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        {t("home.noTrips")}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
