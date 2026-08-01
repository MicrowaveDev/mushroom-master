import { getEarnedRunAchievements, getRunAchievementsByIds } from '../../../app/shared/run-achievements.js';
import { getRunSeasonSummary, getSeasonProgressSummary, getSeasonPointsBreakdown } from '../../../app/shared/season-levels.js';
import { RunCompleteScreen as CoreRunCompleteScreen } from '@microwavedev/backpack-game-core/vue/components';

export const RunCompleteScreen = {
  name: 'RunCompleteScreen',
  components: { CoreRunCompleteScreen },
  props: ['state', 't'],
  emits: ['go-home', 'play-again'],
  computed: {
    player() {
      const playerId = this.state.bootstrap?.player?.id;
      return this.state.gameRunResult?.player
        || (playerId ? this.state.gameRunResult?.playerResults?.[playerId] : null)
        || this.state.gameRun?.player
        || {};
    },
    wins() {
      return this.player.wins || 0;
    },
    losses() {
      return this.player.losses || 0;
    },
    roundsCompleted() {
      return this.player.completedRounds || 0;
    },
    livesRemaining() {
      return Math.max(0, this.player.livesRemaining || 0);
    },
    winRate() {
      if (!this.roundsCompleted) return 0;
      return Math.round((this.wins / this.roundsCompleted) * 100);
    },
    winShare() {
      if (!this.roundsCompleted) return 0;
      return Math.round((this.wins / this.roundsCompleted) * 100);
    },
    lossShare() {
      if (!this.roundsCompleted) return 0;
      return Math.max(0, 100 - this.winShare);
    },
    roundTimeline() {
      const sourceRounds = Array.isArray(this.state.gameRunResult?.rounds) ? this.state.gameRunResult.rounds : [];
      const viewerPlayerId = this.player.playerId || this.state.bootstrap?.player?.id || null;
      const viewerRounds = sourceRounds
        .filter((round) => !viewerPlayerId || !round.playerId || round.playerId === viewerPlayerId)
        .filter((round) => round.outcome === 'win' || round.outcome === 'loss')
        .sort((a, b) => (a.roundNumber || 0) - (b.roundNumber || 0));
      const outcomes = viewerRounds.length >= this.roundsCompleted
        ? viewerRounds.map((round) => round.outcome)
        : this.fallbackRoundOutcomes();
      return outcomes.map((outcome, index) => ({
        key: `${index}-${outcome}`,
        icon: outcome === 'win' ? '🏆' : '💔',
        label: outcome === 'win' ? this.t.outcomeWin : this.t.outcomeLoss,
        tone: outcome
      }));
    },
    seasonSummary() {
      const persisted = this.state.gameRunResult?.season;
      if (persisted) {
        return {
          ...getSeasonProgressSummary(
            persisted.totalPoints ?? persisted.points ?? 0,
            this.state.lang || 'en',
            persisted.runPoints ?? 0,
            persisted.peakPoints ?? persisted.totalPoints ?? persisted.points ?? 0
          ),
          seasonId: persisted.seasonId || persisted.season_id || 'season_1',
          leveledUp: Boolean(persisted.leveledUp),
          leveledDown: Boolean(persisted.leveledDown),
          levelChanged: Boolean(persisted.levelChanged || persisted.leveledUp || persisted.leveledDown),
          breakdown: persisted.breakdown || null
        };
      }
      return {
        ...getRunSeasonSummary({
        wins: this.wins,
        losses: this.losses,
        roundsCompleted: this.roundsCompleted,
        endReason: this.endReason
        }, this.state.lang || 'en'),
        leveledUp: false,
        leveledDown: false,
        levelChanged: false,
        breakdown: null
      };
    },
    seasonBreakdown() {
      return this.seasonSummary.breakdown || getSeasonPointsBreakdown({
        wins: this.wins,
        losses: this.losses,
        roundsCompleted: this.roundsCompleted,
        endReason: this.endReason
      });
    },
    formattedRunPoints() {
      const value = Number(this.seasonSummary.runPoints || 0);
      return value > 0 ? `+${value}` : String(value);
    },
    runPointsTone() {
      return Number(this.seasonSummary.runPoints || 0) < 0 ? 'run-season-run-points--negative' : 'run-season-run-points--positive';
    },
    seasonBreakdownText() {
      const b = this.seasonBreakdown;
      const parts = [
        `${this.t.wins} +${b.winsPoints}`
      ];
      if (b.lossesPenalty) parts.push(`${this.t.losses} ${b.lossesPenalty}`);
      if (b.clearBonus) parts.push(`${this.t.clearBonus} +${b.clearBonus}`);
      if (b.abandonPenalty) parts.push(`${this.t.abandonPenalty} ${b.abandonPenalty}`);
      return parts.join(' / ');
    },
    mushroomId() {
      return this.player.mushroomId || this.state.bootstrap?.activeMushroomId || null;
    },
    bonus() {
      const bonus = this.state.gameRun?.completionBonus || this.state.gameRunResult?.completionBonus || null;
      if (!bonus || typeof bonus !== 'object') return null;
      if (Number.isFinite(bonus.spore) || Number.isFinite(bonus.mycelium)) return bonus;
      const playerId = this.state.bootstrap?.player?.id;
      if (playerId && bonus[playerId]) return bonus[playerId];
      return Object.values(bonus).find((value) => value && typeof value === 'object') || null;
    },
    hasBonus() {
      const b = this.bonus;
      return b && (b.spore > 0 || b.mycelium > 0);
    },
    endReason() {
      return this.state.gameRun?.endReason || this.state.gameRunResult?.endReason || null;
    },
    outcomeTone() {
      if (this.endReason === 'max_rounds') return 'cleared';
      if (this.endReason === 'max_losses') return 'eliminated';
      return 'ended';
    },
    titleText() {
      if (this.endReason === 'max_rounds') return this.t.runCompleteClearedTitle || this.t.runComplete;
      if (this.endReason === 'max_losses') return this.t.outcomeLoss || this.t.runCompleteEliminatedTitle || this.t.runComplete;
      return this.t.runComplete;
    },
    reasonText() {
      if (this.endReason === 'max_rounds') return this.t.runCompleteClearedText || this.t.maxRounds;
      if (this.endReason === 'max_losses') return this.t.eliminated || this.t.runCompleteEliminatedText;
      return this.t.runCompleteAbandonedText || this.t.abandonRun;
    },
    lastRound() {
      return this.state.gameRunResult?.lastRound || null;
    },
    lastRoundOutcomeLabel() {
      if (!this.lastRound) return '';
      if (this.lastRound.outcome === 'win') return this.t.outcomeWin;
      if (this.lastRound.outcome === 'loss') return this.t.outcomeLoss;
      return this.t.outcomeDraw;
    },
    lastRoundRewardText() {
      const rewards = this.lastRound?.rewards || {};
      const parts = [];
      if (rewards.spore) parts.push(`+${rewards.spore} ${this.t.spore}`);
      if (rewards.mycelium) parts.push(`+${rewards.mycelium} ${this.t.mycelium}`);
      return parts.join(' / ');
    },
    runTotals() {
      const sourceRounds = Array.isArray(this.state.gameRunResult?.rounds) ? this.state.gameRunResult.rounds : [];
      const viewerPlayerId = this.player.playerId || this.state.bootstrap?.player?.id || null;
      let spore = 0;
      let mycelium = 0;
      for (const round of sourceRounds) {
        if (viewerPlayerId && round.playerId && round.playerId !== viewerPlayerId) continue;
        spore += Number(round.rewards?.spore || 0);
        mycelium += Number(round.rewards?.mycelium || 0);
      }
      const bonus = this.bonus;
      if (bonus) {
        spore += Number(bonus.spore || 0);
        mycelium += Number(bonus.mycelium || 0);
      }
      return { spore, mycelium };
    },
    runEarnedText() {
      const totals = this.runTotals;
      const parts = [];
      if (totals.spore) parts.push(`+${totals.spore} ${this.t.spore}`);
      if (totals.mycelium) parts.push(`+${totals.mycelium} ${this.t.mycelium}`);
      return parts.join(' · ');
    },
    earnedAchievements() {
      const persisted = this.state.gameRunResult?.achievements;
      if (Array.isArray(persisted)) {
        return getRunAchievementsByIds(persisted, this.state.lang || 'en');
      }
      return getEarnedRunAchievements({
        mushroomId: this.mushroomId,
        endReason: this.endReason,
        lastOutcome: this.lastRound?.outcome || null,
        wins: this.wins,
        losses: this.losses,
        roundsCompleted: this.roundsCompleted,
        livesRemaining: this.livesRemaining,
        winRate: this.winRate,
        seasonLevel: this.seasonSummary.id,
        seasonPoints: this.seasonSummary.points
      }, this.state.lang || 'en');
    },
    summary() {
      return {
        tone: this.outcomeTone,
        title: this.titleText,
        reason: this.reasonText,
        timelineLabel: `${this.t.wins}: ${this.wins}, ${this.t.losses}: ${this.losses}`,
        timeline: this.roundTimeline,
        earnings: this.runEarnedText ? {
          label: this.t.earnedThisRun,
          value: this.runEarnedText
        } : null,
        primaryLabel: this.t.playAgain,
        secondaryLabel: this.t.home,
        season: {
          id: this.seasonSummary.id,
          kicker: this.t.seasonLevel,
          name: this.seasonSummary.name,
          lore: this.seasonSummary.lore,
          points: this.seasonSummary.points,
          pointsLabel: this.t.seasonPoints,
          runPointsText: this.seasonSummary.runPoints
            ? `${this.formattedRunPoints} ${this.t.thisRun}`
            : '',
          runPointsTone: this.runPointsTone,
          progress: this.seasonSummary.progress,
          peakText: `${this.t.seasonPeakRank}: ${this.seasonSummary.peakName} · ${this.seasonSummary.peakPoints}`,
          nextText: this.seasonSummary.isMax
            ? this.t.seasonMaxLevel
            : `${this.seasonSummary.pointsToNext} ${this.t.seasonPointsToNext} ${this.seasonSummary.nextName}`,
          leveledUp: this.seasonSummary.leveledUp,
          leveledDown: this.seasonSummary.leveledDown,
          imageBasePath: '/season-ranks'
        },
        achievements: {
          title: this.t.achievementsEarned,
          items: this.earnedAchievements,
          newLabel: this.t.newAchievement,
          earnedLabel: this.t.alreadyEarned,
          emptyTitle: this.t.achievementNoneTitle,
          emptyHint: this.t.achievementNoneHint,
          imageBasePath: '/achievements'
        }
      };
    }
  },
  mounted() {
    this.emitGameFeelHooks();
    this.reportTelegramGameScore();
  },
  methods: {
    telegramScoreValue() {
      const rawScore = this.seasonSummary?.points
        ?? this.seasonSummary?.totalPoints
        ?? this.state.gameRunResult?.season?.totalPoints
        ?? null;
      const score = Math.floor(Number(rawScore));
      return Number.isFinite(score) && score >= 0 ? score : null;
    },
    reportTelegramGameScore() {
      const context = this.state.telegramGameContext;
      const score = this.telegramScoreValue();
      const runId = this.state.gameRunResult?.id || this.state.gameRun?.id || '';
      if (!context || score == null || !this.state.sessionKey || typeof fetch !== 'function') return;
      if (!context.inlineMessageId && (!context.chatId || !context.messageId)) return;
      const reportKey = `telegramGameScore:${runId}:${score}:${context.inlineMessageId || `${context.chatId}:${context.messageId}`}`;
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(reportKey)) return;

      fetch('/api/bot/game-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Key': this.state.sessionKey
        },
        body: JSON.stringify({
          score,
          chatId: context.chatId,
          messageId: context.messageId,
          inlineMessageId: context.inlineMessageId
        })
      })
        .then((response) => {
          if (response.ok && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(reportKey, '1');
          }
        })
        .catch(() => {});
    },
    emitGameFeelHooks() {
      if (typeof window === 'undefined') return;
      if (this.seasonSummary.levelChanged) {
        const direction = this.seasonSummary.leveledDown ? 'down' : 'up';
        this.logGameFeelEvent('season_rank_change', {
          levelId: this.seasonSummary.id,
          previousLevelId: this.state.gameRunResult?.season?.previousLevelId || null,
          seasonId: this.seasonSummary.seasonId,
          direction,
          runPoints: this.seasonSummary.runPoints,
          totalPoints: this.seasonSummary.totalPoints
        });
      }
      if (this.seasonSummary.leveledUp) {
        window.dispatchEvent(new CustomEvent('mushroom:season-tier-up', {
          detail: { levelId: this.seasonSummary.id, seasonId: this.seasonSummary.seasonId }
        }));
        this.logGameFeelEvent('season_tier_up', {
          levelId: this.seasonSummary.id,
          seasonId: this.seasonSummary.seasonId
        });
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success');
      }
      const newAchievements = this.earnedAchievements.filter((achievement) => achievement.isNew);
      if (newAchievements.length) {
        const achievementIds = newAchievements.map((achievement) => achievement.id);
        window.dispatchEvent(new CustomEvent('mushroom:achievement-unlock', {
          detail: { achievements: achievementIds }
        }));
        this.logGameFeelEvent('achievement_unlock', { achievements: achievementIds });
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
      }
    },
    logGameFeelEvent(eventName, detail) {
      if (typeof fetch !== 'function' || !this.state.sessionKey) return;
      fetch('/api/client-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Key': this.state.sessionKey
        },
        body: JSON.stringify({
          event: eventName,
          detail,
          gameRunId: this.state.gameRunResult?.id || this.state.gameRun?.id || null
        })
      }).catch(() => {});
    },
    fallbackRoundOutcomes() {
      const lastOutcome = this.lastRound?.outcome === 'win' || this.lastRound?.outcome === 'loss'
        ? this.lastRound.outcome
        : null;
      let wins = this.wins;
      let losses = this.losses;
      if (lastOutcome === 'win') wins = Math.max(0, wins - 1);
      if (lastOutcome === 'loss') losses = Math.max(0, losses - 1);
      const outcomes = [
        ...Array.from({ length: wins }, () => 'win'),
        ...Array.from({ length: losses }, () => 'loss')
      ];
      if (lastOutcome) outcomes.push(lastOutcome);
      return outcomes;
    }
  },
  template: `
    <CoreRunCompleteScreen
      :summary="summary"
      @primary="$emit('play-again')"
      @secondary="$emit('go-home')"
    />
  `
};
