"use client";

import {useEffect ,useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function ChessWithAI() {
  const [game, setGame] = useState(new Chess());
  const [isAITurn, setIsAITurn] = useState(false); // Track AI's turn
  const [boardWidth, setBoardWidth] = useState(400); // Default board width

  async function fetchAIMove(fen) {
    try {
      console.log("Fetching AI move...");
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/predict/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        params: { fen },
      });

      if (!response.ok) throw new Error("Failed to fetch AI move");
      const data = await response.json();
      console.log("AI Move:", data.prediction);
      return data.prediction;
    } catch (error) {
      console.error("Error fetching AI move:", error);
      return null;
    }
  }

  function makeAMove(move) {
    const result = game.move(move);
    console.log("Move:", game.fen());
    setGame(game);
    return result; // null if the move was illegal, the move object if the move was legal
  }


  async function makeAIMove() {
    if (game.turn() !== "b") {
      console.log("It's not Black's turn.");
      return;
    }

    console.log("AI's Turn...");
    setIsAITurn(true); // Disable button while AI is moving

    const aiMove = await fetchAIMove(game.fen());

    if (aiMove) {
      makeAMove({
        from: aiMove.slice(0, 2),
        to: aiMove.slice(2, 4),
        promotion: "q",
      });
    } else {
      console.error("AI move was null.");
    }

    setIsAITurn(false); // Re-enable button after AI move
  }

  function onDrop(sourceSquare, targetSquare) {
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q", // always promote to a queen for example simplicity
    });

    // illegal move
    if (move === null) return false;
    setTimeout(makeAIMove, 200);
    return true;
  }

  useEffect(() => {
    function updateBoardWidth() {
      setBoardWidth(Math.min(window.innerWidth, window.innerHeight) * 0.95);
    }

    updateBoardWidth();
    window.addEventListener("resize", updateBoardWidth);
  }, []);

  return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh"}}>
      <Chessboard 
        position={game.fen()}
        onPieceDrop={onDrop}
        areArrowsAllowed={false}
        autoPromoteToQueen={true}
        boardWidth={boardWidth} // Fit to the smaller dimension
      />
    </div>
  );
}
