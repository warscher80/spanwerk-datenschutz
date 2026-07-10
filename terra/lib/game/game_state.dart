import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'board.dart';
import 'persistence.dart';

const int kBoardSize = 6;

class GameState {
  const GameState({
    required this.board,
    required this.score,
    required this.best,
    required this.maxTier,
    required this.next,
    required this.gameOver,
    this.lastGain = 0,
    this.lastMergeTier = -1,
    this.lastPlaced = -1,
    this.ready = false,
  });

  final Board board;
  final int score;
  final int best;

  /// Höchster je erreichter Rang (für die Sammlung).
  final int maxTier;

  /// Nächstes zu setzendes Objekt (Rang).
  final int next;
  final bool gameOver;

  final int lastGain;
  final int lastMergeTier;
  final int lastPlaced;

  /// Erst nach dem Laden true – vorher zeigt die UI einen ruhigen Ladezustand.
  final bool ready;

  GameState copyWith({
    Board? board,
    int? score,
    int? best,
    int? maxTier,
    int? next,
    bool? gameOver,
    int? lastGain,
    int? lastMergeTier,
    int? lastPlaced,
    bool? ready,
  }) {
    return GameState(
      board: board ?? this.board,
      score: score ?? this.score,
      best: best ?? this.best,
      maxTier: maxTier ?? this.maxTier,
      next: next ?? this.next,
      gameOver: gameOver ?? this.gameOver,
      lastGain: lastGain ?? this.lastGain,
      lastMergeTier: lastMergeTier ?? this.lastMergeTier,
      lastPlaced: lastPlaced ?? this.lastPlaced,
      ready: ready ?? this.ready,
    );
  }
}

class GameController extends StateNotifier<GameState> {
  GameController() : super(_empty()) {
    _init();
  }

  final Random _rng = Random();

  static GameState _empty() => GameState(
        board: Board(kBoardSize),
        score: 0,
        best: 0,
        maxTier: -1,
        next: 0,
        gameOver: false,
      );

  Future<void> _init() async {
    final saved = await loadGame();
    if (saved != null &&
        saved.size == kBoardSize &&
        saved.cells.contains(-1)) {
      state = GameState(
        board: Board.fromCells(kBoardSize, List<int>.from(saved.cells)),
        score: saved.score,
        best: saved.best,
        maxTier: saved.maxTier,
        next: saved.next,
        gameOver: false,
        ready: true,
      );
    } else {
      state = _fresh(saved?.best ?? 0, saved?.maxTier ?? -1);
    }
  }

  GameState _fresh(int best, int maxTier) => GameState(
        board: Board(kBoardSize),
        score: 0,
        best: best,
        maxTier: maxTier,
        next: _spawn(),
        gameOver: false,
        ready: true,
      );

  /// Meist Sternenstaub, gelegentlich schon etwas Höheres.
  int _spawn() {
    final r = _rng.nextDouble();
    if (r < 0.80) return 0;
    if (r < 0.96) return 1;
    return 2;
  }

  void place(int i) {
    final s = state;
    if (!s.ready || s.gameOver) return;

    final board = s.board.copy();
    final res = board.place(i, s.next);
    if (res == null) return; // Zelle belegt.

    final score = s.score + res.gained;
    final best = max(s.best, score);
    final maxTier = [s.maxTier, res.highestMerged, board.highestTier()]
        .reduce((a, b) => a > b ? a : b);
    final next = _spawn();
    final gameOver = board.isFull;

    state = s.copyWith(
      board: board,
      score: score,
      best: best,
      maxTier: maxTier,
      next: next,
      gameOver: gameOver,
      lastGain: res.gained,
      lastMergeTier: res.highestMerged,
      lastPlaced: i,
    );
    _persist();
  }

  void restart() {
    state = _fresh(state.best, state.maxTier);
    _persist();
  }

  void _persist() {
    final s = state;
    saveGame(SaveData(
      cells: s.board.cells,
      size: kBoardSize,
      score: s.score,
      best: s.best,
      maxTier: s.maxTier,
      next: s.next,
    ));
  }
}

final gameProvider =
    StateNotifierProvider<GameController, GameState>((ref) => GameController());
