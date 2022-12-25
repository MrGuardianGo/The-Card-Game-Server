const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(function (req, res, next) {
  // Website you wish to allow to connect
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Request methods you wish to allow
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  // Request headers you wish to allow
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader("Access-Control-Allow-Credentials", true);

  // Pass to next layer of middleware
  next();
});

let PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log("Changes made on", PORT);
});

app.get("/", (req, res) => {
  res.send("Server is up and running!");
});

io = socket(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

global.playerRooms = new Map();
global.roomsDetails = new Map();

let cards = [];
const cardTypes = ["1", "2", "3", "4"];
let i = 0;
while (i < 4) {
  for (let j = 0; j < 4; j++) {
    cards.push(cardTypes[j]);
  }
  i++;
}
const allEqual = (arr) => arr.every((v) => v === arr[0]);
function checkIfAllEqual(cards) {
  if (cards.length === 4) {
    return allEqual(cards);
  } else {
    return false;
  }
}

io.on("connection", (socket) => {
  socket.on("join-room", (data) => {
    const currentPlayers = Array.from(playerRooms).filter(
      (player) => player[1].roomID === data.roomID
    );
    let currentPlayersArray = [];
    currentPlayers.forEach((player) => {
      currentPlayersArray.push(player[1].username);
    });
    if (currentPlayersArray.length >= 4) {
      console.log("Room is full");
      socket.emit("exception", {
        errorMessage: "The room you are trying to join is full...",
      });
    } else {
      if (currentPlayersArray.indexOf(data.username) === -1) {
        socket.join(data.roomID);
        playerRooms.set(socket.id, {
          username: data.username,
          roomID: data.roomID,
        });
        const allPlayers = Array.from(playerRooms).filter(
          (player) => player[1].roomID === data.roomID
        );
        let allPlayersArray = [];
        allPlayers.forEach((player) => {
          allPlayersArray.push(player[1].username);
        });
        io.to(data.roomID).emit("room-players", allPlayersArray);
        if (allPlayersArray.length === 4) {
          io.to(data.roomID).emit(
            "game-status",
            "The game will begin shortly..."
          );
          setTimeout(() => {
            let finalAllPlayersArray = [];
            Array.from(playerRooms)
              .filter((player) => player[1].roomID === data.roomID)
              .forEach((player) => {
                finalAllPlayersArray.push(player[1].username);
              });
            if (finalAllPlayersArray.length === 4) {
              function shuffleArray(array) {
                return array.sort(() => Math.random() - 0.5);
              }
              const shuffledDeck = shuffleArray(cards);
              let finalDeck = [];
              let shuffledPlayers = [];
              const playersCards = [];
              const chunkSize = 4;
              let j = 0;
              for (let i = 0; i < shuffledDeck.length; i += chunkSize) {
                const chunk = shuffledDeck.slice(i, i + chunkSize);
                playersCards.push(chunk);
              }
              playersCards.forEach((deck) => {
                finalDeck.push({ player: allPlayersArray[j], cards: deck });
                j++;
              });

              shuffleArray(allPlayersArray).forEach((player) => {
                shuffledPlayers.push(player);
              });

              roomsDetails.set(data.roomID, {
                shuffledPlayers: shuffledPlayers,
                finalDeck: finalDeck,
                winners: [],
              });

              io.emit("start-game", {
                finalDeck,
                players: shuffledPlayers,
                username: data.username,
                turn: shuffledPlayers[0],
              });
            } else {
              io.to(data.roomID).emit("game-status", "Joining/Creating Room");
            }
          }, 3000);
        }
      } else {
        socket.emit("exception", {
          errorMessage:
            "Player with the same username already exists in the room. Try changing your username...",
        });
      }
    }
  });
  socket.on("giveaway", (data) => {
    let finalDeck = roomsDetails.get(data.roomID).finalDeck;
    let shuffledPlayers = roomsDetails.get(data.roomID).shuffledPlayers;
    const giver = shuffledPlayers.indexOf(data.giver);
    let taker;
    if (giver < shuffledPlayers.length - 1) {
      taker = shuffledPlayers[giver + 1];
    } else if (giver === shuffledPlayers.length - 1) {
      taker = shuffledPlayers[0];
    }
    const giverIndex = finalDeck.findIndex((obj) => obj.player == data.giver);
    let giverCards = finalDeck[giverIndex].cards;
    socket.to(socket.id).emit("counter", i);
    for (let i = 0; i < giverCards.length; i++) {
      const item = giverCards[i];
      if (item === data.card) {
        giverCards.splice(i, 1);
        break;
      }
    }
    finalDeck[giverIndex].cards = giverCards;
    const takerIndex = finalDeck.findIndex((obj) => obj.player == taker);
    let takerCards = finalDeck[takerIndex].cards;
    finalDeck[takerIndex].cards = [...takerCards, data.card];
    roomsDetails.set(data.roomID, {
      finalDeck: finalDeck,
      shuffledPlayers: shuffledPlayers,
      winners: [],
    });
    finalDeck.map((set) => {
      if (checkIfAllEqual(set.cards)) {
        io.to(socket.id).emit("activate-win-btn", true);
      }
    });
    io.to(data.roomID).emit("game-manager", {
      finalDeck: finalDeck,
      turn: taker,
    });
  });
  socket.on("win-button-pressed", (data) => {
    let finalDeck = roomsDetails.get(data.roomID).finalDeck;
    let shuffledPlayers = roomsDetails.get(data.roomID).shuffledPlayers;
    const winners = new Set();
    roomsDetails.get(data.roomID).winners.forEach((w) => {
      winners.add(w);
    });

    if (
      (checkIfAllEqual(data.cards) &&
        roomsDetails.get(data.roomID).winners.length === 0) ||
      (!checkIfAllEqual(data.cards) &&
        roomsDetails.get(data.roomID).winners.length !== 0)
    ) {
      if (roomsDetails.get(data.roomID).winners.indexOf(data.username) === -1) {
        winners.add(data.username);
        roomsDetails.set(data.roomID, {
          finalDeck,
          shuffledPlayers,
          winners: [...Array.from(winners), data.username],
        });
      }
    }
    socket.broadcast
      .to(data.roomID)
      .emit("winners", { winners: Array.from(winners) });
  });
  socket.on("disconnect", () => {
    if (playerRooms.get(socket.id)) {
      const roomID = playerRooms.get(socket.id).roomID;
      playerRooms.delete(socket.id);
      const allPlayers = Array.from(playerRooms).filter(
        (player) => player[1].roomID === roomID
      );
      let allPlayersArray = [];
      allPlayers.forEach((player) => {
        allPlayersArray.push(player[1].username);
      });
      io.to(roomID).emit("room-players", allPlayersArray);
    }
  });
});
