import { useEffect, useState, useRef } from "react";

import { Chess } from "chess.js";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { formatEval, getMoveCategoryBgColor, capitalizeString } from "@/lib/utils";

const GameAnalysisInterface = ({ fen, currentPly, reportStatus, moveAnalyses }) => {
  const [minDepth, setMinDepth] = useState(8);
  const [maxDepth, setMaxDepth] = useState(20);
  const [multiPV, setMultiPV] = useState(3);
  const [engineResults, setEngineResults] = useState([]);
  const [currentDepth, setCurrentDepth] = useState(0);

  const chess = new Chess(fen);

  useEffect(() => {
    setEngineResults([]);
    setCurrentDepth(minDepth);
    const engineWorker = new Worker("/stockfish-16.1-lite-single.js");
    
    engineWorker.onmessage = (event) => {
      const message = event.data;
  
      if (message.startsWith("info") && message.includes("score")) {
        const regex = /depth (\d+) seldepth \d+ multipv (\d+) score (?:cp (-?\d+)|mate (-?\d+)) nodes \d+ nps \d+ hashfull \d+ time \d+ pv (.+)/;
        const match = message.match(regex);
  
        if (match) {
          const tempChess = new Chess(chess.fen());

          const depth = parseInt(match[1]);
          const multipv = parseInt(match[2]);
          const cp = match[3] ? parseInt(chess.turn() === "w" ? match[3] : -match[3]) : null;
          const mateIn = match[4] ? parseInt(chess.turn() === "w" ? match[4] : -match[4]) : null;
          const continuation = match[5].split(" ").map((move) => tempChess.move(move).san);
          
          if (depth >= minDepth) {
            setEngineResults((prev) => {
              const updatedResults = prev.filter((result) => result.multipv !== multipv);
              return [...updatedResults, {
                depth,
                multipv,
                cp,
                mateIn,
                continuation,
              }];
            });
            setCurrentDepth(depth);
          }
        }
      }
    };
  
    // Send initial commands to the Stockfish engine
    engineWorker.postMessage("uci");
    engineWorker.postMessage(`setoption name MultiPV value ${multiPV}`);
    engineWorker.postMessage(`position fen ${fen}`);
    engineWorker.postMessage(`go depth ${maxDepth}`);
  
    return () => {
      engineWorker.postMessage("stop");
      engineWorker.terminate();
    };
  }, [fen, maxDepth, multiPV]);

  return (
    <Card className="w-full">
      <div className="flex flex-row p-4 justify-between items-center">
        {currentPly > 0 && reportStatus === "complete" ?
          <div className="flex flex-row gap-2 items-center">
            <Badge className={`text-xl rounded-md -my-2 ${getMoveCategoryBgColor(moveAnalyses[currentPly - 1].moveCategory)}`} variant="secondary">
              {moveAnalyses[currentPly - 1].move}
            </Badge>
            <h3>: {capitalizeString(moveAnalyses[currentPly - 1].moveCategory)}</h3>
          </div> : 
          <h3>Analysis</h3>
        }
        <p>Depth: {currentDepth}</p>
      </div>
      <Separator />
      <div className="flex flex-col p-4 gap-2">
        {Array.from({ length: multiPV }, (_, index) => {
          const result = engineResults[index] || { cp: null, mateIn: null, continuation: [] };
          const isWhitesTurn = currentPly % 2 === 0;

          const formattedContinuation = result.continuation.map((move, i) => {
            return isWhitesTurn && i % 2 === 0 ? `${move}` : `${move}`;
          });

          return (
            <div key={index} className="grid grid-cols-[60px_70px_1fr] gap-3 items-center h-5">
              <Badge className={`font-mono text-sm p-0 block text-center ${(result.cp || result.mateIn) >= 0 ? "bg-white text-black" : "bg-black text-white"}`}>
                {formatEval(result)}
              </Badge>
              <Badge className="block text-center" variant="secondary">{formattedContinuation[0] || "-"}</Badge>
              <p className="whitespace-nowrap overflow-hidden text-ellipsis">{formattedContinuation.slice(1).join(" ") || "-"}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default GameAnalysisInterface;
