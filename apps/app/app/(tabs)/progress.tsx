import { Screen } from '../../src/components/Screen';
import { StateCard } from '../../src/components/StateCard';
import { ActivityCalendarCard } from '../../src/features/progress/ActivityCalendarCard';
import { CefrTrendCard } from '../../src/features/progress/CefrTrendCard';
import { ErrorHeatmapCard } from '../../src/features/progress/ErrorHeatmapCard';
import { LevelEventList } from '../../src/features/progress/LevelEventList';
import { ProgressOverviewCard } from '../../src/features/progress/ProgressOverviewCard';
import { SkillProgressList } from '../../src/features/progress/SkillProgressList';
import { SkillRadarCard } from '../../src/features/progress/SkillRadarCard';
import { WeekSummaryCard } from '../../src/features/progress/WeekSummaryCard';
import { useProgress } from '../../src/features/progress/useProgress';
import { useProfile } from '../../src/providers/ProfileProvider';

export default function ProgressScreen() {
  const { t } = useProfile();
  const { loading, error, progress, insights, reload } = useProgress();

  if (loading) {
    return (
      <Screen title={t('progress.title')}>
        <StateCard variant="loading" message={t('progress.loading')} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title={t('progress.title')}>
        <StateCard
          variant="error"
          message={t('errors.network')}
          actionLabel={t('common.retry')}
          onAction={reload}
        />
      </Screen>
    );
  }

  if (
    !progress ||
    (progress.skills.length === 0 &&
      progress.events.length === 0 &&
      progress.cefrTrend.length === 0)
  ) {
    return (
      <Screen title={t('progress.title')}>
        <StateCard message={t('progress.noData')} />
      </Screen>
    );
  }

  return (
    <Screen title={t('progress.title')}>
      <ProgressOverviewCard progress={progress} />
      {insights ? <WeekSummaryCard insights={insights} /> : null}
      <SkillRadarCard radar={progress.skillRadar} />
      <CefrTrendCard trend={progress.cefrTrend} />
      {insights ? <ActivityCalendarCard heatmap={insights.heatmap} /> : null}
      {insights ? <ErrorHeatmapCard errors={insights.errorHeatmap} /> : null}
      <SkillProgressList skills={progress.skills} />
      <LevelEventList events={progress.events} />
    </Screen>
  );
}
