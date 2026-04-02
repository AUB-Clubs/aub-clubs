import { Separator } from "@/components/ui/separator";

interface EventDetails {
  scale: string | null;
  type: string | null;
  topic: string | null;
  selectedIdea: string | null;
}

interface EventReport {
  markdown: string;
}

interface EventSpeaker {
  id: string;
  name: string;
  title: string | null;
  sessionFocus: string | null;
}

interface EventSponsor {
  id: string;
  name: string;
  type: string | null;
  specificContribution: string | null;
}

interface EventBuilding {
  id: string;
  name: string;
  why: string | null;
}

interface FragmentData {
  eventDetails: EventDetails | null;
  eventReport: EventReport | null;
  eventSpeakers: EventSpeaker[];
  eventSponsors: EventSponsor[];
  eventBuildings: EventBuilding[];
}

interface Props {
  fragment: FragmentData;
}

export default function PreviewTab({ fragment }: Props) {
  const { eventDetails, eventReport, eventSpeakers, eventSponsors, eventBuildings } = fragment;

  const isEmpty =
    !eventDetails &&
    !eventReport &&
    eventSpeakers.length === 0 &&
    eventSponsors.length === 0 &&
    eventBuildings.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        No event data yet.
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      {eventDetails && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Event Details
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {eventDetails.scale && (
              <span className="text-sm">
                <span className="text-muted-foreground">Scale: </span>
                {eventDetails.scale}
              </span>
            )}
            {eventDetails.type && (
              <span className="text-sm">
                <span className="text-muted-foreground">Type: </span>
                {eventDetails.type}
              </span>
            )}
            {eventDetails.topic && (
              <span className="text-sm">
                <span className="text-muted-foreground">Topic: </span>
                {eventDetails.topic}
              </span>
            )}
          </div>
          {eventDetails.selectedIdea && (
            <blockquote className="mt-2 rounded-md border-l-2 bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground">
              "{eventDetails.selectedIdea}"
            </blockquote>
          )}
        </section>
      )}

      {eventReport && (
        <>
          {eventDetails && <Separator />}
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Event Report
            </h3>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed">
              {eventReport.markdown}
            </div>
          </section>
        </>
      )}

      {eventSpeakers.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Speakers ({eventSpeakers.length})
            </h3>
            <ul className="space-y-2">
              {eventSpeakers.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-medium">{s.name}</span>
                  {s.title && (
                    <span className="text-muted-foreground"> — {s.title}</span>
                  )}
                  {s.sessionFocus && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.sessionFocus}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {eventSponsors.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sponsors ({eventSponsors.length})
            </h3>
            <ul className="space-y-2">
              {eventSponsors.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-medium">{s.name}</span>
                  {s.type && (
                    <span className="text-muted-foreground"> ({s.type})</span>
                  )}
                  {s.specificContribution && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.specificContribution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {eventBuildings.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Venues ({eventBuildings.length})
            </h3>
            <ul className="space-y-2">
              {eventBuildings.map((b) => (
                <li key={b.id} className="text-sm">
                  <span className="font-medium">{b.name}</span>
                  {b.why && (
                    <p className="text-xs text-muted-foreground mt-0.5">{b.why}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
