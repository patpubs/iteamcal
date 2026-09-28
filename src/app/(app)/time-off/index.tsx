import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { TypeBadge } from '@/components/time-off/parts';
import {
  AppText,
  Badge,
  Button,
  Card,
  ColorDot,
  Divider,
  ErrorText,
  Field,
  IconButton,
  ListRow,
  Loading,
  Screen,
  SectionTitle,
  Segmented,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { type Crew, displayName, useCrew, useProfiles } from '@/features/team';
import {
  type TimeOff,
  type TimeOffRequest,
  useCancelRequest,
  useDecideRequest,
  useRequests,
  useTimeOffEntries,
  useTimeOffRealtime,
} from '@/features/time-off';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction, errorMessage } from '@/lib/confirm';
import { addDays, addMonths, monthLabel, monthStart, today } from '@/lib/dates';
import { coverageFor, rangeText } from '@/lib/time-off';
import { useAuth } from '@/providers/auth';

export default function TimeOffScreen() {
  const { isAdmin } = useAuth();
  useTimeOffRealtime();
  return isAdmin ? <AdminTimeOff /> : <MyTimeOff />;
}

// ─── Staff ──────────────────────────────────────────────────────────────────

function MyTimeOff() {
  const { profile } = useAuth();
  const now = today();
  const { pending, decided } = useRequests();
  // Upcoming: anything still running today through the next year.
  const entries = useTimeOffEntries(now, addDays(now, 366));
  const cancel = useCancelRequest();
  const [error, setError] = useState<string | null>(null);

  if (!profile?.crew_id) {
    return (
      <Screen>
        <AppText variant="title">Time off</AppText>
        <Card>
          <AppText muted>
            Your account isn’t linked to a crew member yet, so there’s no time off to show. Ask an admin to link you.
          </AppText>
        </Card>
      </Screen>
    );
  }

  async function onCancel(r: TimeOffRequest) {
    const ok = await confirmAction('Cancel this request?', rangeText(r), 'Cancel request');
    if (!ok) return;
    setError(null);
    try {
      await cancel.mutateAsync(r.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <AppText variant="title">Time off</AppText>
      <Button label="Request time off" onPress={() => router.push('/time-off/request')} />
      <ErrorText>{error}</ErrorText>

      {pending.data?.length ? (
        <>
          <SectionTitle>{`Waiting for a decision (${pending.data.length})`}</SectionTitle>
          <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
            {pending.data.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: Spacing.sm, gap: Spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <AppText variant="label" style={{ flex: 1 }}>
                      {rangeText(r)}
                    </AppText>
                    <TypeBadge type={r.type} />
                  </View>
                  {r.reason ? <AppText muted>{r.reason}</AppText> : null}
                  <Button
                    label="Cancel request"
                    variant="secondary"
                    onPress={() => onCancel(r)}
                    disabled={cancel.isPending}
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Upcoming days off</SectionTitle>
      {entries.isPending ? (
        <Loading />
      ) : (
        <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
          {entries.data?.length ? (
            entries.data.map((t, i) => (
              <View key={t.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={rangeText(t)} subtitle={t.reason} trailing={<TypeBadge type={t.type} />} />
              </View>
            ))
          ) : (
            <AppText muted style={{ paddingVertical: Spacing.md }}>
              Nothing booked yet.
            </AppText>
          )}
        </Card>
      )}

      {decided.data?.length ? (
        <>
          <SectionTitle>Past requests</SectionTitle>
          <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
            {decided.data.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={rangeText(r)}
                  subtitle={r.decision_note ? `“${r.decision_note}”` : r.reason}
                  trailing={<StatusBadge status={r.status} />}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function StatusBadge({ status }: { status: TimeOffRequest['status'] }) {
  if (status === 'approved') return <Badge label="Approved" tone="primary" />;
  if (status === 'declined') return <Badge label="Declined" tone="danger" />;
  return <Badge label="Waiting" tone="accent" />;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

function AdminTimeOff() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = params.tab === 'days' ? 'days' : 'requests';
  const { pending } = useRequests();
  const count = pending.data?.length ?? 0;

  return (
    <Screen>
      <AppText variant="title">Time off</AppText>
      <Segmented
        options={[
          { value: 'requests', label: count ? `Requests (${count})` : 'Requests' },
          { value: 'days', label: 'Days off' },
        ]}
        value={tab}
        onChange={(v) => router.setParams({ tab: v })}
      />
      {tab === 'requests' ? <AdminRequests /> : <AdminDaysOff />}
    </Screen>
  );
}

function AdminRequests() {
  const { pending, decided } = useRequests();
  const crew = useCrew();
  const profiles = useProfiles();
  // Coverage needs everyone's recorded time off across the pending dates.
  const span = useMemo(() => {
    const p = pending.data ?? [];
    if (!p.length) return null;
    return {
      from: p.reduce((m, r) => (r.start_date < m ? r.start_date : m), p[0].start_date),
      to: p.reduce((m, r) => (r.end_date > m ? r.end_date : m), p[0].end_date),
    };
  }, [pending.data]);
  const others = useTimeOffEntries(span?.from ?? '1900-01-01', span?.to ?? '1900-01-01');

  if (pending.isPending || crew.isPending) return <Loading />;
  const crewById = new Map((crew.data ?? []).map((c) => [c.id, c]));
  const requesterName = (r: TimeOffRequest) => {
    const p = profiles.data?.find((x) => x.id === r.requester_id);
    return crewById.get(r.crew_id)?.name ?? (p ? displayName(p, crew.data) : 'Someone');
  };

  return (
    <>
      <ErrorText>{pending.error ? errorMessage(pending.error) : null}</ErrorText>
      {pending.data?.length ? (
        pending.data.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            name={requesterName(r)}
            crew={crewById.get(r.crew_id)}
            coverage={coverageFor(r, others.data ?? [], pending.data ?? []).map((c) => ({
              ...c,
              name: crewById.get(c.crew_id)?.name ?? 'Someone',
            }))}
          />
        ))
      ) : (
        <Card>
          <AppText muted>No requests are waiting.</AppText>
        </Card>
      )}

      {decided.data?.length ? (
        <>
          <SectionTitle>Decided (last 50)</SectionTitle>
          <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
            {decided.data.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={`${requesterName(r)} · ${rangeText(r)}`}
                  subtitle={r.decision_note ? `“${r.decision_note}”` : r.reason}
                  leading={<ColorDot color={crewById.get(r.crew_id)?.color ?? 'transparent'} />}
                  trailing={<StatusBadge status={r.status} />}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

function RequestCard({
  request: r,
  name,
  crew,
  coverage,
}: {
  request: TimeOffRequest;
  name: string;
  crew?: Crew;
  coverage: { crew_id: string; kind: 'off' | 'pending'; name: string }[];
}) {
  const theme = useTheme();
  const decide = useDecideRequest();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const off = coverage.filter((c) => c.kind === 'off');
  const alsoAsking = coverage.filter((c) => c.kind === 'pending');

  async function onDecide(approve: boolean) {
    if (!approve) {
      const ok = await confirmAction(`Decline ${name}’s request?`, rangeText(r), 'Decline');
      if (!ok) return;
    }
    setError(null);
    try {
      await decide.mutateAsync({ id: r.id, approve, note });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <ColorDot color={crew?.color ?? 'transparent'} />
        <AppText variant="heading" style={{ flex: 1 }}>
          {name}
        </AppText>
        <TypeBadge type={r.type} />
      </View>
      <AppText variant="label">{rangeText(r)}</AppText>
      {r.reason ? <AppText muted>{r.reason}</AppText> : null}
      {off.length || alsoAsking.length ? (
        <View style={{ backgroundColor: theme.accentSoft, borderRadius: 8, padding: Spacing.sm, gap: 2 }}>
          {off.length ? (
            <AppText variant="caption" style={{ color: theme.accent, fontWeight: '600' }}>
              {`Already off then: ${off.map((c) => c.name).join(', ')}`}
            </AppText>
          ) : null}
          {alsoAsking.length ? (
            <AppText variant="caption" style={{ color: theme.accent, fontWeight: '600' }}>
              {`Also asking: ${alsoAsking.map((c) => c.name).join(', ')}`}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <Field label="Note to them (optional)" value={note} onChangeText={setNote} placeholder="e.g. Enjoy the trip" />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Decline" variant="danger" onPress={() => onDecide(false)} disabled={decide.isPending} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Approve" onPress={() => onDecide(true)} loading={decide.isPending} />
        </View>
      </View>
    </Card>
  );
}

function AdminDaysOff() {
  const [month, setMonth] = useState(monthStart(today()));
  const last = addDays(addMonths(month, 1), -1);
  const entries = useTimeOffEntries(month, last);
  const crew = useCrew();
  const crewById = new Map((crew.data ?? []).map((c) => [c.id, c]));

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
        <IconButton
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          label="Previous month"
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <AppText variant="heading" style={{ flex: 1, textAlign: 'center' }} accessibilityRole="header">
          {monthLabel(month)}
        </AppText>
        <IconButton
          icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          label="Next month"
          onPress={() => setMonth(addMonths(month, 1))}
        />
      </View>
      <Button label="Record time off" onPress={() => router.push('/time-off/entry')} />
      <ErrorText>{entries.error ? errorMessage(entries.error) : null}</ErrorText>
      {entries.isPending ? (
        <Loading />
      ) : (
        <Card style={{ paddingVertical: Spacing.xs, gap: 0 }}>
          {entries.data?.length ? (
            entries.data.map((t: TimeOff, i) => {
              const c = crewById.get(t.crew_id);
              return (
                <View key={t.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={c?.name ?? 'Former crew member'}
                    subtitle={[rangeText(t), t.reason].filter(Boolean).join(' · ')}
                    leading={<ColorDot color={c?.color ?? 'transparent'} />}
                    trailing={<TypeBadge type={t.type} />}
                    onPress={() => router.push({ pathname: '/time-off/entry', params: { id: t.id } })}
                  />
                </View>
              );
            })
          ) : (
            <AppText muted style={{ paddingVertical: Spacing.md }}>
              No one has time off in {monthLabel(month)}.
            </AppText>
          )}
        </Card>
      )}
    </>
  );
}
