import { getEarnedRunAchievements, getRunAchievementsByIds } from '../../../app/shared/run-achievements.js';
import { getRunSeasonSummary, getSeasonProgressSummary, getSeasonPointsBreakdown } from '../../../app/shared/season-levels.js';

export const RunCompleteScreen = {
  name: 'RunCompleteScreen',
  props: ['state', 't'],
  emits: ['go-home'],
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
    seasonSummary() {
      const persisted = this.state.gameRunResult?.season;
      if (persisted) {
        return {
          ...getSeasonProgressSummary(persisted.totalPoints ?? persisted.points ?? 0, this.state.lang || 'en', persisted.runPoints || 0),
          seasonId: persisted.seasonId || persisted.season_id || 'season_1',
          leveledUp: Boolean(persisted.leveledUp),
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
        breakdown: null
      };
    },
    seasonBreakdown() {
      return this.seasonSummary.breakdown || getSeasonPointsBreakdown({
        wins: this.wins,
        roundsCompleted: this.roundsCompleted,
        endReason: this.endReason
      });
    },
    rankPalette() {
      const palettes = {
        bronze:  { highlight: '#f5d8a3', mid: '#c98a4a', deep: '#7d4a1f', ring: '#5d3712', glyph: '#fdeac6' },
        silver:  { highlight: '#f4f8fa', mid: '#aab9c1', deep: '#65737a', ring: '#3a464d', glyph: '#ffffff' },
        gold:    { highlight: '#fff1be', mid: '#e0b545', deep: '#8b631a', ring: '#5e4310', glyph: '#fff7d6' },
        diamond: { highlight: '#e9fbff', mid: '#86c8d9', deep: '#3a6b81', ring: '#1f3e51', glyph: '#dff6ff' }
      };
      return palettes[this.seasonSummary.id] || palettes.bronze;
    },
    seasonBreakdownText() {
      const b = this.seasonBreakdown;
      const parts = [
        `${this.t.wins} +${b.winsPoints}`,
        `${this.t.roundsCompleted} +${b.roundsPoints}`
      ];
      if (b.clearBonus) parts.push(`${this.t.clearBonus} +${b.clearBonus}`);
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
      if (this.endReason === 'max_losses') return this.t.runCompleteEliminatedTitle || this.t.runComplete;
      return this.t.runComplete;
    },
    reasonText() {
      if (this.endReason === 'max_rounds') return this.t.runCompleteClearedText || this.t.maxRounds;
      if (this.endReason === 'max_losses') return this.t.runCompleteEliminatedText || this.t.eliminated;
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
  },
  methods: {
    emitGameFeelHooks() {
      if (typeof window === 'undefined') return;
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
    }
  },
  template: `
    <section class="run-complete-screen" :class="'run-complete-screen--' + outcomeTone">
      <div class="panel run-complete-card">
        <div class="run-complete-hero">
          <p class="run-complete-kicker">{{ t.runCompleteKicker }}</p>
          <h2>{{ titleText }}</h2>
          <p class="run-end-reason">{{ reasonText }}</p>
        </div>

        <dl class="stat-grid run-complete-stats">
          <div class="stat run-complete-stat--primary"><dt>{{ t.wins }}</dt><dd>{{ wins }}</dd></div>
          <div class="stat"><dt>{{ t.roundsCompleted }}</dt><dd>{{ roundsCompleted }}</dd></div>
          <div class="stat"><dt>{{ t.losses }}</dt><dd>{{ losses }}</dd></div>
          <div class="stat"><dt>{{ t.runWinRate }}</dt><dd>{{ winRate }}%</dd></div>
        </dl>

        <section class="run-season-card" :class="['run-season-card--' + seasonSummary.id, { 'run-season-card--level-up': seasonSummary.leveledUp }]">
          <div class="run-season-emblem" :class="'run-season-emblem--' + seasonSummary.id" aria-hidden="true">
            <svg viewBox="0 0 96 96" class="run-season-emblem-svg">
              <defs>
                <radialGradient :id="'rankGradient-' + seasonSummary.id" cx="50%" cy="38%" r="62%">
                  <stop offset="0%" :stop-color="rankPalette.highlight" />
                  <stop offset="58%" :stop-color="rankPalette.mid" />
                  <stop offset="100%" :stop-color="rankPalette.deep" />
                </radialGradient>
              </defs>
              <circle cx="48" cy="48" r="42" :fill="'url(#rankGradient-' + seasonSummary.id + ')'" :stroke="rankPalette.ring" stroke-width="3" />
              <circle cx="48" cy="48" r="32" fill="none" :stroke="rankPalette.ring" stroke-opacity="0.42" stroke-width="1.5" />
              <g v-if="seasonSummary.id === 'bronze'" :fill="rankPalette.glyph">
                <circle cx="48" cy="48" r="6" />
              </g>
              <g v-else-if="seasonSummary.id === 'silver'" :fill="rankPalette.glyph">
                <circle cx="40" cy="48" r="5" />
                <circle cx="56" cy="48" r="5" />
              </g>
              <g v-else-if="seasonSummary.id === 'gold'" :fill="rankPalette.glyph">
                <polygon points="48,28 51,42 65,44 54,53 58,67 48,59 38,67 42,53 31,44 45,42" />
              </g>
              <g v-else-if="seasonSummary.id === 'diamond'" :fill="rankPalette.glyph" :stroke="rankPalette.ring" stroke-width="1.4" stroke-linejoin="round">
                <polygon points="48,26 66,46 48,70 30,46" />
                <polyline points="36,46 60,46" :stroke="rankPalette.ring" stroke-width="1.2" fill="none" stroke-opacity="0.55" />
                <polyline points="48,26 48,70" :stroke="rankPalette.ring" stroke-width="1.2" fill="none" stroke-opacity="0.55" />
              </g>
            </svg>
          </div>
          <div class="run-season-copy">
            <p class="run-complete-kicker">{{ t.seasonLevel }}</p>
            <h3>{{ seasonSummary.name }}</h3>
            <p>{{ seasonSummary.lore }}</p>
          </div>
          <div class="run-season-meter">
            <span class="run-season-points">{{ seasonSummary.points }} {{ t.seasonPoints }}</span>
            <span v-if="seasonSummary.runPoints" class="run-season-run-points">+{{ seasonSummary.runPoints }} {{ t.thisRun }}</span>
            <div class="run-season-progress" aria-hidden="true">
              <span :style="{ width: seasonSummary.progress + '%' }"></span>
            </div>
            <span class="run-season-breakdown">{{ seasonBreakdownText }}</span>
            <span class="run-season-next">
              {{ seasonSummary.isMax ? t.seasonMaxLevel : seasonSummary.pointsToNext + ' ' + t.seasonPointsToNext + ' ' + seasonSummary.nextName }}
            </span>
          </div>
        </section>

        <div v-if="hasBonus" class="run-complete-body">
          <div class="run-complete-bonus">
            <h3 class="run-complete-bonus-heading">{{ t.completionBonus }}</h3>
            <dl class="stat-grid">
              <div class="stat"><dt>{{ t.spore }}</dt><dd>+{{ bonus.spore || 0 }}</dd></div>
              <div class="stat"><dt>{{ t.mycelium }}</dt><dd>+{{ bonus.mycelium || 0 }}</dd></div>
            </dl>
          </div>
        </div>

        <div v-if="lastRound" class="run-complete-last-round">
          <div>
            <p class="run-complete-last-label">{{ t.lastBattle }}</p>
            <strong>{{ t.round }} {{ lastRound.roundNumber }} · {{ lastRoundOutcomeLabel }}</strong>
          </div>
          <span v-if="lastRoundRewardText" class="run-complete-reward-chip">{{ lastRoundRewardText }}</span>
        </div>

        <section v-if="earnedAchievements.length" class="run-achievements" :aria-label="t.achievementsEarned">
          <div class="run-achievements-heading-row">
            <p class="run-complete-kicker">{{ t.achievementsEarned }}</p>
            <span class="run-achievements-count">{{ earnedAchievements.length }}</span>
          </div>
          <div class="run-achievement-list">
            <article
              v-for="(achievement, index) in earnedAchievements"
              :key="achievement.id"
              :style="{ animationDelay: (index * 90) + 'ms' }"
              class="run-achievement"
              :class="achievementClass(achievement)"
            >
              <span class="achievement-badge" aria-hidden="true">
                <span class="achievement-badge-core"></span>
                <span class="achievement-badge-glyph">{{ achievement.badgeSymbol }}</span>
              </span>
              <div>
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

        <button class="primary run-complete-action" @click="$emit('go-home')">{{ t.home }}</button>
      </div>
    </section>
  `
};
