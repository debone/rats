import type { DemoEntry } from './demoTypes';

import { fountain } from './demos/particles/fountain';
import { explosion } from './demos/particles/explosion';
import { rain } from './demos/particles/rain';
import { fire } from './demos/particles/fire';

import { staggerGrid } from './demos/animations/staggerGrid';
import { sequenceChain } from './demos/animations/sequenceChain';
import { bouncePhysics } from './demos/animations/bouncePhysics';
import { screenWipe } from './demos/animations/screenWipe';
import { counterTick } from './demos/animations/counterTick';

import { crtControls } from './demos/shaders/crtControls';
import { reflectionControls } from './demos/shaders/reflectionControls';
import { colorMatrix } from './demos/shaders/colorMatrix';
import { blurPulse } from './demos/shaders/blurPulse';

import { flexPlayground } from './demos/ui/flexPlayground';
import { buttonStates } from './demos/ui/buttonStates';
import { counterTick as animatedCounter } from './demos/animations/counterTick';

import { traumaShake } from './demos/camera/traumaShake';
import { zoomCinematic } from './demos/camera/zoomCinematic';
import { punchShakeFade } from './demos/camera/punchShakeFade';

import { levelIntro } from './demos/cutscenes/levelIntro';
import { ratAbilityIntro } from './demos/cutscenes/ratAbilityIntro';
import { dialogBox } from './demos/cutscenes/dialogBox';
import { victoryScreen } from './demos/cutscenes/victoryScreen';
import { bossWarning } from './demos/cutscenes/bossWarning';
import { countdown } from './demos/cutscenes/countdown';
import { scoreSummary } from './demos/cutscenes/scoreSummary';
import { crewJoin } from './demos/cutscenes/crewJoin';
import { secretFound } from './demos/cutscenes/secretFound';
import { gameOver } from './demos/cutscenes/gameOver';
import { missionBriefing } from './demos/cutscenes/missionBriefing';
import { chapterCard } from './demos/cutscenes/chapterCard';
import { upgradeAcquired } from './demos/cutscenes/upgradeAcquired';
import { levelFailed } from './demos/cutscenes/levelFailed';
import { cinematicLetterbox } from './demos/cutscenes/cinematicLetterbox';
import { wantedPoster } from './demos/cutscenes/wantedPoster';
import { itemPickup } from './demos/cutscenes/itemPickup';
import { powerUpActivate } from './demos/cutscenes/powerUpActivate';
import { ratSelect } from './demos/cutscenes/ratSelect';
import { transmissionReceived } from './demos/cutscenes/transmissionReceived';
import { sewerDescent } from './demos/cutscenes/sewerDescent';
import { guardSpotlight } from './demos/cutscenes/guardSpotlight';
import { tunnelMap } from './demos/cutscenes/tunnelMap';
import { pipeRupture } from './demos/cutscenes/pipeRupture';
import { sewageSurge } from './demos/cutscenes/sewageSurge';
import { safecrack } from './demos/cutscenes/safecrack';
import { ratHorde } from './demos/cutscenes/ratHorde';
import { sprayGraffiti } from './demos/cutscenes/sprayGraffiti';
import { fogCrawl } from './demos/cutscenes/fogCrawl';
import { heistPlanning } from './demos/cutscenes/heistPlanning';

import { flipbookExplosion } from './demos/vfx/flipbookExplosion';
import { flipbookRipple } from './demos/vfx/flipbookRipple';
import { swordTrail } from './demos/vfx/swordTrail';
import { ribbonTrail } from './demos/vfx/ribbonTrail';
import { bulletStretch } from './demos/vfx/bulletStretch';
import { arrowFlight } from './demos/vfx/arrowFlight';
import { impactFlash } from './demos/vfx/impactFlash';
import { lightningBolt } from './demos/vfx/lightningBolt';
import { starParticles } from './demos/vfx/starParticles';
import { magicTrail } from './demos/vfx/magicTrail';

import { reactiveText } from './demos/signals/reactiveText';
import { signalChain } from './demos/signals/signalChain';

import { clickableBricks } from './demos/interactions/clickableBricks';
import { ballToBrick } from './demos/interactions/ballToBrick';
import { cheeseMagnet } from './demos/interactions/cheeseMagnet';
import { doorOpener } from './demos/interactions/doorOpener';
import { comboCounter } from './demos/interactions/comboCounter';
import { ballBounce } from './demos/interactions/ballBounce';

export const REGISTRY: DemoEntry[] = [
  // Particles
  { id: 'particles-fountain',  category: 'particles',   name: 'Fountain',       setup: fountain },
  { id: 'particles-explosion', category: 'particles',   name: 'Explosion',      setup: explosion },
  { id: 'particles-rain',      category: 'particles',   name: 'Rain',           setup: rain },
  { id: 'particles-fire',      category: 'particles',   name: 'Fire + Smoke',   setup: fire },

  // Animations
  { id: 'anim-stagger',        category: 'animations',  name: 'Stagger Grid',   setup: staggerGrid },
  { id: 'anim-sequence',       category: 'animations',  name: 'Sequence Chain', setup: sequenceChain },
  { id: 'anim-bounce',         category: 'animations',  name: 'Bounce Physics', setup: bouncePhysics },
  { id: 'anim-wipe',           category: 'animations',  name: 'Screen Wipe',    setup: screenWipe },
  { id: 'anim-counter',        category: 'animations',  name: 'Counter Tick',   setup: counterTick },

  // Shaders
  { id: 'shader-crt',          category: 'shaders',     name: 'CRT Controls',   setup: crtControls },
  { id: 'shader-reflect',      category: 'shaders',     name: 'Reflection',     setup: reflectionControls },
  { id: 'shader-color',        category: 'shaders',     name: 'Color Matrix',   setup: colorMatrix },
  { id: 'shader-blur',         category: 'shaders',     name: 'Blur Pulse',     setup: blurPulse },

  // UI
  { id: 'ui-flex',             category: 'ui',          name: 'Flex Playground', setup: flexPlayground },
  { id: 'ui-buttons',          category: 'ui',          name: 'Button States',  setup: buttonStates },
  { id: 'ui-counter',          category: 'ui',          name: 'Animated Counter', setup: animatedCounter },

  // Camera
  { id: 'cam-shake',           category: 'camera',      name: 'Trauma Shake',   setup: traumaShake },
  { id: 'cam-zoom',            category: 'camera',      name: 'Zoom Cinematic', setup: zoomCinematic },
  { id: 'cam-combo',           category: 'camera',      name: 'Punch→Shake→Fade', setup: punchShakeFade },

  // Cutscenes
  { id: 'cut-intro',           category: 'cutscenes',   name: 'Level Intro',      setup: levelIntro },
  { id: 'cut-rat',             category: 'cutscenes',   name: 'Rat Ability',      setup: ratAbilityIntro },
  { id: 'cut-dialog',          category: 'cutscenes',   name: 'Dialog Box',       setup: dialogBox },
  { id: 'cut-victory',         category: 'cutscenes',   name: 'Victory Screen',   setup: victoryScreen },
  { id: 'cut-boss',            category: 'cutscenes',   name: 'Boss Warning',     setup: bossWarning },
  { id: 'cut-countdown',       category: 'cutscenes',   name: 'Countdown 3-2-1',  setup: countdown },
  { id: 'cut-score',           category: 'cutscenes',   name: 'Score Summary',    setup: scoreSummary },
  { id: 'cut-crew',            category: 'cutscenes',   name: 'Crew Join',        setup: crewJoin },
  { id: 'cut-secret',          category: 'cutscenes',   name: 'Secret Found',     setup: secretFound },
  { id: 'cut-gameover',        category: 'cutscenes',   name: 'Game Over',        setup: gameOver },
  { id: 'cut-briefing',        category: 'cutscenes',   name: 'Mission Briefing', setup: missionBriefing },
  { id: 'cut-chapter',         category: 'cutscenes',   name: 'Chapter Card',     setup: chapterCard },
  { id: 'cut-upgrade',         category: 'cutscenes',   name: 'Upgrade Acquired', setup: upgradeAcquired },
  { id: 'cut-failed',          category: 'cutscenes',   name: 'Level Failed',     setup: levelFailed },
  { id: 'cut-letterbox',       category: 'cutscenes',   name: 'Cinematic',        setup: cinematicLetterbox },
  { id: 'cut-wanted',          category: 'cutscenes',   name: 'Wanted Poster',    setup: wantedPoster },
  { id: 'cut-item',            category: 'cutscenes',   name: 'Item Pickup',      setup: itemPickup },
  { id: 'cut-powerup',         category: 'cutscenes',   name: 'Power-Up Activate', setup: powerUpActivate },
  { id: 'cut-ratselect',       category: 'cutscenes',   name: 'Rat Select',       setup: ratSelect },
  { id: 'cut-transmission',    category: 'cutscenes',   name: 'Transmission',     setup: transmissionReceived },
  { id: 'cut-sewer-descent',   category: 'cutscenes',   name: 'Sewer Descent',    setup: sewerDescent },
  { id: 'cut-guard-spot',      category: 'cutscenes',   name: 'Guard Spotlight',  setup: guardSpotlight },
  { id: 'cut-tunnel-map',      category: 'cutscenes',   name: 'Tunnel Map',       setup: tunnelMap },
  { id: 'cut-pipe-rupture',    category: 'cutscenes',   name: 'Pipe Rupture',     setup: pipeRupture },
  { id: 'cut-sewage-surge',    category: 'cutscenes',   name: 'Sewage Surge',     setup: sewageSurge },
  { id: 'cut-safecrack',       category: 'cutscenes',   name: 'Safecrack',        setup: safecrack },
  { id: 'cut-rat-horde',       category: 'cutscenes',   name: 'Rat Horde',        setup: ratHorde },
  { id: 'cut-spray-graffiti',  category: 'cutscenes',   name: 'Spray Graffiti',   setup: sprayGraffiti },
  { id: 'cut-fog-crawl',       category: 'cutscenes',   name: 'Fog Crawl',        setup: fogCrawl },
  { id: 'cut-heist-planning',  category: 'cutscenes',   name: 'Heist Planning',   setup: heistPlanning },

  // VFX Techniques
  { id: 'vfx-flipbook-explosion', category: 'vfx', name: 'Flipbook: Explosion',  setup: flipbookExplosion },
  { id: 'vfx-flipbook-ripple',    category: 'vfx', name: 'Flipbook: Ripple',     setup: flipbookRipple },
  { id: 'vfx-sword-trail',        category: 'vfx', name: 'Trail: Sword Swing',   setup: swordTrail },
  { id: 'vfx-ribbon-trail',       category: 'vfx', name: 'Trail: Ribbon Orb',    setup: ribbonTrail },
  { id: 'vfx-bullet-stretch',     category: 'vfx', name: 'Orient: Bullet Stretch', setup: bulletStretch },
  { id: 'vfx-arrow-flight',       category: 'vfx', name: 'Orient: Arrow Flight', setup: arrowFlight },
  { id: 'vfx-impact-flash',       category: 'vfx', name: 'Flash: Impact Hit',    setup: impactFlash },
  { id: 'vfx-lightning',          category: 'vfx', name: 'Flash: Lightning Bolt', setup: lightningBolt },
  { id: 'vfx-star-particles',     category: 'vfx', name: 'Sprite: Star Particles', setup: starParticles },
  { id: 'vfx-magic-trail',        category: 'vfx', name: 'Sprite: Magic Trail',  setup: magicTrail },

  // Signals
  { id: 'sig-reactive',        category: 'signals',     name: 'Reactive Text',  setup: reactiveText },
  { id: 'sig-chain',           category: 'signals',     name: 'Signal Chain',   setup: signalChain },

  // Interactions
  { id: 'int-click-bricks',   category: 'interactions', name: 'Clickable Bricks', setup: clickableBricks },
  { id: 'int-ball-to-brick',  category: 'interactions', name: 'Ball → Brick',     setup: ballToBrick },
  { id: 'int-cheese-magnet',  category: 'interactions', name: 'Cheese Magnet',    setup: cheeseMagnet },
  { id: 'int-door-opener',    category: 'interactions', name: 'Door Opener',      setup: doorOpener },
  { id: 'int-combo',          category: 'interactions', name: 'Combo Counter',    setup: comboCounter },
  { id: 'int-ball-bounce',    category: 'interactions', name: 'Mini Breakout',    setup: ballBounce },
];
