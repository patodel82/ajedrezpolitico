export class AIPlayer {
  constructor(color = 'b', elo = 1300) {
    this.color = color; // 'b' for black (Peronistas) or 'w' for white (Libertarios)
    this.elo = elo;
    
    // Piece values for evaluation
    this.pieceValues = {
      p: 100,
      n: 320,
      b: 330,
      r: 500,
      q: 900,
      k: 20000
    };

    // Positional evaluation tables (from White's perspective)
    // E.g. Pawns are encouraged to advance, Knights are encouraged to be in center.
    this.pawnTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5,  5, 10, 25, 25, 10,  5,  5],
      [0,  0,  0, 20, 20,  0,  0,  0],
      [5, -5,-10,  0,  0,-10, -5,  5],
      [5, 10, 10,-20,-20, 10, 10,  5],
      [0,  0,  0,  0,  0,  0,  0,  0]
    ];

    this.knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,  0,  0,  0,  0,-20,-40],
      [-30,  0, 10, 15, 15, 10,  0,-30],
      [-30,  5, 15, 20, 20, 15,  5,-30],
      [-30,  0, 15, 20, 20, 15,  0,-30],
      [-30,  5, 10, 15, 15, 10,  5,-30],
      [-40,-20,  0,  5,  5,  0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];

    this.bishopTable = [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5, 10, 10,  5,  0,-10],
      [-10,  5,  5, 10, 10,  5,  5,-10],
      [-10,  0, 10, 10, 10, 10,  0,-10],
      [-10, 10, 10, 10, 10, 10, 10,-10],
      [-10,  5,  0,  0,  0,  0,  5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ];

    this.rookTable = [
      [0,  0,  0,  0,  0,  0,  0,  0],
      [5, 10, 10, 10, 10, 10, 10,  5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [-5,  0,  0,  0,  0,  0,  0, -5],
      [0,  0,  0,  5,  5,  0,  0,  0]
    ];

    this.queenTable = [
      [-20,-10,-10, -5, -5,-10,-10,-20],
      [-10,  0,  0,  0,  0,  0,  0,-10],
      [-10,  0,  5,  5,  5,  5,  0,-10],
      [-5,  0,  5,  5,  5,  5,  0, -5],
      [0,  0,  5,  5,  5,  5,  0, -5],
      [-10,  5,  5,  5,  5,  5,  0,-10],
      [-10,  0,  5,  0,  0,  5,  0,-10],
      [-20,-10,-10, -5, -5,-10,-10,-20]
    ];

    this.kingMiddleTable = [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [20, 20,  0,  0,  0,  0, 20, 20],
      [20, 30, 10,  0,  0, 10, 30, 20]
    ];
  }

  // Evaluates the board position from the perspective of active player
  evaluateBoard(board) {
    let totalEvaluation = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const value = this.getPieceValue(piece, r, c);
          if (piece.color === 'w') {
            totalEvaluation += value;
          } else {
            totalEvaluation -= value;
          }
        }
      }
    }
    return totalEvaluation;
  }

  getPieceValue(piece, row, col) {
    const baseValue = this.pieceValues[piece.type];
    let posValue = 0;
    
    // Invert board tables for black pieces
    const r = piece.color === 'w' ? row : 7 - row;
    const c = piece.color === 'w' ? col : 7 - col;

    switch (piece.type) {
      case 'p': posValue = this.pawnTable[r][c]; break;
      case 'n': posValue = this.knightTable[r][c]; break;
      case 'b': posValue = this.bishopTable[r][c]; break;
      case 'r': posValue = this.rookTable[r][c]; break;
      case 'q': posValue = this.queenTable[r][c]; break;
      case 'k': posValue = this.kingMiddleTable[r][c]; break;
    }

    return baseValue + posValue;
  }

  // Minimax algorithm with Alpha-Beta pruning
  minimax(chess, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || chess.isGameOver()) {
      return this.evaluateBoard(chess.board());
    }

    const moves = chess.moves({ verbose: true });
    
    // 1300 ELO Simulation: Introduce tiny error/variance or sub-optimal choice periodically
    // E.g., sort moves but sometimes pick slightly worse ones, or limit search depth.
    if (isMaximizingPlayer) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move.san);
        const evaluation = this.minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) {
          break;
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move.san);
        const evaluation = this.minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) {
          break;
        }
      }
      return minEval;
    }
  }

  // Calculate the best move for ELO ~1300
  getBestMove(chess) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = null;
    let bestValue = this.color === 'w' ? -Infinity : Infinity;

    // Sort moves to speed up alpha-beta pruning (captures first)
    moves.sort((a, b) => {
      const scoreA = (a.captured ? this.pieceValues[a.captured] : 0) - (a.promotion ? 1 : 0);
      const scoreB = (b.captured ? this.pieceValues[b.captured] : 0) - (b.promotion ? 1 : 0);
      return scoreB - scoreA;
    });

    const evaluatedMoves = [];

    // Search depth of 3 provides a very decent ~1300 ELO play.
    const depth = 3; 

    for (const move of moves) {
      chess.move(move.san);
      const val = this.minimax(chess, depth - 1, -Infinity, Infinity, this.color === 'w');
      chess.undo();

      evaluatedMoves.push({ move, val });
    }

    // Sort evaluated moves based on our goal
    if (this.color === 'w') {
      evaluatedMoves.sort((a, b) => b.val - a.val);
    } else {
      evaluatedMoves.sort((a, b) => a.val - b.val);
    }

    // 1300 ELO Simulation:
    // A 1300 ELO player doesn't make perfect moves 100% of the time. 
    // They will pick the absolute best move about 75% of the time, and a slightly 
    // sub-optimal (e.g. 2nd or 3rd best) move 25% of the time.
    const rand = Math.random();
    if (rand < 0.75 || evaluatedMoves.length === 1) {
      bestMove = evaluatedMoves[0].move;
    } else if (rand < 0.93 && evaluatedMoves.length > 1) {
      bestMove = evaluatedMoves[1].move;
    } else {
      bestMove = evaluatedMoves[Math.min(evaluatedMoves.length - 1, 2)].move;
    }

    return bestMove;
  }
}
