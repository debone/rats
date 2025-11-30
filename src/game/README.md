# Game Architecture

This folder contains the core game logic, separated from the app-level screens and navigation.

## Structure

```
/game
  /core          - Core game classes and types
  /systems       - Modular game systems
  /levels        - Level definitions
  /entities      - Game entities (TODO)
  /components    - Reusable entity components (TODO)
```

## Core Concepts

### Three-Tier State Management

The game maintains three levels of state:

1. **MetaGameState** - Persistent across sessions (saved to storage)
   - Unlocked levels, completed levels, high scores
   - Permanent upgrades, total coins, achievements
   - Used to restore game state after browser refresh

2. **RunState** - Persists across levels in a single run
   - Current level, levels completed in this run
   - Active boons (temporary powerups)
   - Lives, score, difficulty
   - Cleared when run ends (game over or quit)

3. **LevelState** - Transient, specific to current level
   - Balls remaining, bricks destroyed
   - Powerups collected, elapsed time
   - Reset when new level starts

### Game Context

The `GameContext` is shared across all systems and levels, providing access to:

- Physics world (`worldId`)
- Visual container
- State (meta, run, level)
- Systems (`SystemRunner`)
- Events (`EventEmitter`)

### Coroutine-Style Flows

Complex sequences (like level completion) are handled using async generators:

```typescript
private async *levelCompleteFlow(result: LevelResult) {
  // 1. Play cutscene
  yield this.playCutscene('complete');

  // 2. Show map
  yield this.showMap();

  // 3. Wait for player input
  const nextLevel = yield this.waitForLevelSelection();

  // 4. Start next level
  yield this.startLevel(nextLevel);
}
```

This approach makes it easy to create complex, multi-step sequences without callback hell or rigid state machines.

## Systems

Systems are modular, reusable components that handle specific aspects of the game:

- **PhysicsSystem** - Manages Box2D world, stepping, debug draw
- **SaveSystem** - Handles save/load, auto-save
- **CollisionSystem** (TODO) - Processes collision events
- **InputSystem** (TODO) - Centralized input handling
- **EntitySystem** (TODO) - Entity spawning/despawning
- **AudioSystem** (TODO) - Sound effects and music

### Creating a System

```typescript
export class MySystem implements System {
  static SYSTEM_ID = 'my-system';

  game?: Game;

  init() {
    // Called once on game init
  }

  update(delta: number) {
    // Called every frame
  }

  destroy() {
    // Cleanup
  }
}

// Register in Game.ts:
this.context.systems.add(MySystem);
```

## Levels

Levels are self-contained units that:

- Define geometry (walls, bricks, obstacles)
- Create entities (paddle, ball, powerups)
- Handle win/lose conditions
- Apply active boons from run state

### Creating a Level

```typescript
export default class MyLevel extends Level {
  static id = 'my-level';

  constructor() {
    super({
      id: 'my-level',
      name: 'My Level',
      arena: { width: 35, height: 66 },
      ballSpeed: 10,
    });
  }

  async load() {
    // Setup physics, create entities
  }

  update(delta: number) {
    super.update(delta); // Handles win/lose checks
    // Custom update logic
  }

  protected checkWinCondition(): boolean {
    // Return true when level is won
  }
}
```

Level files should be named with the level ID (e.g., `level-1.ts`) and placed in `/game/levels/`.

## Event System

The game uses an event emitter for coordination between components:

```typescript
// Emit an event
this.context.events.emit('brick:destroyed', { brickId: 'brick-1' });

// Listen for an event
this.context.events.on('brick:destroyed', (data) => {
  console.log('Brick destroyed:', data.brickId);
});

// Wait for an event (in coroutines)
const selection = yield this.context.events.wait('map:level-selected');
```

### Key Events

- `level:started` - Level has started
- `level:won` - Level was won
- `level:lost` - Level was lost
- `level:complete` - Level finished (won or lost)
- `game:show-map` - Request to show map screen
- `map:level-selected` - Player selected a level from map
- `game:show-game-over` - Request to show game over screen
- `game-over:action` - Player chose restart/quit
- `game:quit` - Request to quit to main menu
- `boon:acquired` - Player gained a boon

## Integration with GameScreen

`GameScreen` is a thin wrapper that:

1. Creates and initializes the `Game` instance
2. Forwards lifecycle methods (`update`, `resize`, `pause`, `resume`)
3. Listens for game events and handles UI transitions
4. Manages the visual container for game rendering

```typescript
// GameScreen.ts
export class GameScreen extends Container implements AppScreen {
  public game: Game;

  async prepare() {
    this.game = new Game(this, this._gameContainer);
    await this.game.init();
  }

  async show() {
    // Resume or start new run
    const savedRun = await this.game.context.systems.get(SaveSystem).loadRun();
    if (savedRun) {
      await this.game.resumeRun();
    } else {
      await this.game.startNewRun('level-1');
    }
  }

  update(time: Ticker) {
    this.game.update(time.deltaMS);
  }
}
```

## Future Enhancements

### Entities & Components

Add an entity system for more complex game objects:

```typescript
class Paddle extends Entity {
  speed = 10;

  update(delta: number) {
    // Handle paddle movement
  }

  onCollision(other: Entity) {
    // Handle collision with ball
  }
}
```

### Boon System

Implement boons (temporary powerups that carry across levels):

```typescript
const boons: Boon[] = [
  {
    id: 'multiball',
    name: 'Multiball',
    description: 'Split ball into 3',
    type: 'ball',
    effect: { count: 3 },
  },
  {
    id: 'wider-paddle',
    name: 'Wider Paddle',
    description: '+2 width',
    type: 'paddle',
    effect: { widthBonus: 2 },
  },
];
```

### Map Screen

Create a proper map screen UI for level selection:

- Show unlocked levels
- Display level info (name, high score)
- Animate level completion
- Allow replaying completed levels

### Cutscenes

Add cutscene support for story/transitions:

- Text-based dialogue
- Character animations
- Background transitions
- Skip functionality
