import { getEarnedRunAchievements, getRunAchievementsByIds } from '../../../app/shared/run-achievements.js';
import { getRunSeasonSummary, getSeasonProgressSummary, getSeasonPointsBreakdown } from '../../../app/shared/season-levels.js';
import { SeasonRankEmblem } from '../components/SeasonRankEmblem.js';
import { AchievementBadge } from '../components/AchievementBadge.js';

export const RunCompleteScreen = {
  name: 'RunCompleteScreen',
  components: { SeasonRankEmblem, AchievementBadge },
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
        className: outcome === 'win' ? 'run-complete-round-icon--win' : 'run-complete-round-icon--loss'
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
    achievementClass(achievement) {
      return [
        'run-achievement--' + achievement.type,
        'run-achievement--accent-' + (achievement.accent || achievement.type),
        achievement.isNew ? 'run-achievement--new' : 'run-achievement--earned'
      ];
    },
    achievementRevealDelay(index) {
      return `${760 + index * 180}ms`;
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
    <section class="run-complete-screen" :class="'run-complete-screen--' + outcomeTone">
      <div class="panel run-complete-card">
        <div class="run-complete-hero">
          <h2>{{ titleText }}</h2>
          <p class="run-end-reason">{{ reasonText }}</p>
        </div>

        <div class="run-complete-record" :aria-label="t.wins + ': ' + wins + ', ' + t.losses + ': ' + losses">
          <span
            v-for="round in roundTimeline"
            :key="round.key"
            class="run-complete-round-icon"
            :class="round.className"
            :title="round.label"
            aria-hidden="true"
          >{{ round.icon }}</span>
        </div>

        <p v-if="runEarnedText" class="run-complete-run-earnings">
          <span class="run-complete-run-earnings-label">{{ t.earnedThisRun }}</span>
          <span class="run-complete-run-earnings-values">{{ runEarnedText }}</span>
        </p>

        <div class="run-complete-actions">
          <button class="primary run-complete-action" @click="$emit('play-again')">{{ t.playAgain }}</button>
          <button class="secondary run-complete-action run-complete-action--secondary" @click="$emit('go-home')">{{ t.home }}</button>
        </div>
      </div>

      <div class="run-complete-details">
        <section class="run-season-card" :class="['run-season-card--' + seasonSummary.id, { 'run-season-card--level-up': seasonSummary.leveledUp, 'run-season-card--level-down': seasonSummary.leveledDown }]">
          <div class="run-season-header">
            <season-rank-emblem class="run-season-emblem" :rank-id="seasonSummary.id" :size="96" />

            <div class="run-season-copy">
              <p class="run-complete-kicker">{{ t.seasonLevel }}</p>
              <h3>{{ seasonSummary.name }}</h3>
              <p>{{ seasonSummary.lore }}</p>
            </div>
            <div class="run-season-points-block">
              <span class="run-season-points-value">{{ seasonSummary.points }}</span>
              <span class="run-season-points-label">{{ t.seasonPoints }}</span>
              <span v-if="seasonSummary.runPoints" class="run-season-run-points" :class="runPointsTone">{{ formattedRunPoints }} {{ t.thisRun }}</span>
            </div>
          </div>
          <div class="run-season-meter">
            <div class="run-season-progress" aria-hidden="true">
              <span :style="{ width: seasonSummary.progress + '%' }"></span>
            </div>
            <div class="run-season-meter-footer">
              <span class="run-season-peak">{{ t.seasonPeakRank }}: {{ seasonSummary.peakName }} · {{ seasonSummary.peakPoints }}</span>
              <span class="run-season-next">
                {{ seasonSummary.isMax ? t.seasonMaxLevel : seasonSummary.pointsToNext + ' ' + t.seasonPointsToNext + ' ' + seasonSummary.nextName }}
              </span>
            </div>
          </div>
        </section>

        <section v-if="earnedAchievements.length" class="run-achievements" :aria-label="t.achievementsEarned">
          <div class="run-achievements-heading-row">
            <p class="run-complete-kicker">{{ t.achievementsEarned }}</p>
            <span class="run-achievements-count">{{ earnedAchievements.length }}</span>
          </div>
          <div class="run-achievement-list">
            <article
              v-for="(achievement, index) in earnedAchievements"
              :key="achievement.id"
              :style="{ '--achievement-delay': achievementRevealDelay(index) }"
              class="run-achievement"
              :class="achievementClass(achievement)"
            >
              <achievement-badge :achievement="achievement" size="medium" />
              <div class="run-achievement-copy">
                <h3>
                  {{ achievement.name }}
                  <span v-if="achievement.isNew" class="run-achievement-new">{{ t.newAchievement }}</span>
                  <span v-else class="run-achievement-earned">{{ t.alreadyEarned }}</span>
                </h3>
                <p>{{ achievement.lore }}</p>
              </div>
            </article>
          </div>
        </section>
        <section v-else class="run-achievements run-achievements--empty" :aria-label="t.achievementsEarned">
          <div class="run-achievements-heading-row">
            <p class="run-complete-kicker">{{ t.achievementsEarned }}</p>
          </div>
          <p class="run-achievements-empty-title">{{ t.achievementNoneTitle }}</p>
          <p class="run-achievements-empty-copy">{{ t.achievementNoneHint }}</p>
        </section>
      </div>
    </section>
  `
};
