import { NextRequest, NextResponse } from "next/server";
import * as ort from "onnxruntime-node";
import { Chess } from "chess.js"; // Import chess.js


  function getSortedIndices(array: Float32Array): number[] {
    return [...array].map((value, index) => ({ index, value }))
      .sort((a, b) => b.value - a.value) // Sort descending order of probabilities
      .map(item => item.index);
  }
const pieceToChannel: { [key: string]: number } = {
  "P": 0, "N": 1, "B": 2, "R": 3, "Q": 4, "K": 5, // White Pieces
  "p": 6, "n": 7, "b": 8, "r": 9, "q": 10, "k": 11  // Black Pieces
};

// Convert FEN string to a 12x8x8 tensor (similar to PyTorch)
function fenToTensor(fen: string): Float32Array {
    const tensor = new Float32Array(12 * 8 * 8).fill(0);
    const [position] = fen.split(" ");
    const rows = position.split("/");

    for (let rank = 0; rank < 8; rank++) {
        let file = 0;
        for (const char of rows[rank]) {
            if (/\d/.test(char)) {
                file += parseInt(char, 10);
            } else {
                const channel = pieceToChannel[char];
                if (channel !== undefined) {
                    tensor[channel * 64 + rank * 8 + file] = 1;
                }
                file++;
            }
        }
    }

    return tensor;
}

function indexToSquare(index: number): string {
    const file = String.fromCharCode(97 + (index % 8)); // 'a' to 'h'
    const rank = 8 - Math.floor(index / 8); // 8 to 1
    return `${file}${rank}`;
  }

export async function POST(req: NextRequest) {
    if (req.method !== "POST") {
        return NextResponse.json(
            { message: `Method ${req.method} Not Allowed` },
            { status: 405 },
        );
    }


    try {
        const session = await ort.InferenceSession.create(
            process.cwd() + "/public/chess_model.onnx"
        );

        // Parse input
        const body = await req.json();
        const { fen } = body;
        
        if (!fen) {
            return NextResponse.json({ error: "FEN string is required" }, { status: 400 });
        }

        
    // Initialize the board with the current FEN
     const board = new Chess(fen);

        // Convert FEN to tensor
        const tensorInput = new ort.Tensor("float32", fenToTensor(fen), [1, 12, 8, 8]);

        // Run inference
        const results = await session.run({ input: tensorInput });
       
    const start_candidates = getSortedIndices(results.start_square.data as Float32Array);
    const end_candidates = getSortedIndices(results.end_square.data as Float32Array);

  // Find the best legal move
  let bestMove: string | null = null;

  for (const start_idx of start_candidates) {
    for (const end_idx of end_candidates) {
      const start_square = indexToSquare(start_idx);
      const end_square = indexToSquare(end_idx);
      const move = `${start_square}${end_square}`;

      if (board.moves({ verbose: true }).some(m => m.from === start_square && m.to === end_square)) {
        bestMove = move;
        break;
      }
    }
    if (bestMove) break;
  }

  if (!bestMove) {
    return NextResponse.json({ error: "No legal move found" }, { status: 400 });
  }

  return new NextResponse(JSON.stringify({ move: bestMove }), { status: 200 });
} catch (error) {
  console.error("Error running ONNX model:", error);
  return NextResponse.json({ error: "Model inference failed" }, { status: 500 });
}
}