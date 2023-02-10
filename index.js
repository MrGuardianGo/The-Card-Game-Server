const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-Requested-With,content-type"
  );
  res.setHeader("Access-Control-Allow-Credentials", true);
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
    origin: "*",
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

function chooseCard(cards) {
  function mode(array) {
    if (array.length == 0) return null;
    var modeMap = {};
    var maxEl = array[0],
      maxCount = 1;
    for (var i = 0; i < array.length; i++) {
      var el = array[i];
      if (modeMap[el] == null) modeMap[el] = 1;
      else modeMap[el]++;
      if (modeMap[el] > maxCount) {
        maxEl = el;
        maxCount = modeMap[el];
      }
    }
    return maxEl;
  }
  let filtered = cards.filter((c) => c !== mode(cards));
  return filtered[Math.floor(Math.random() * filtered.length)];
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
  socket.on("bots", (data) => {
    let allOldPlayers = Array.from(playerRooms).filter(
      (player) => player[1].roomID === data.roomID
    );
    let allOldPlayersArray = [];
    allOldPlayers.forEach((player) => {
      allOldPlayersArray.push(player[1].username);
    });
    if (allOldPlayersArray.length >= 4) {
      return;
    }
    const botsRequired = 4 - allOldPlayersArray.length;
    const bots = [];

    for (let i = 0; i < botsRequired; i++) {
      let randomNum = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
      while (playerRooms.get(`Bot ${randomNum}`)) {
        randomNum = Math.floor(Math.random() * (9999 - 1000 + 1) + 1000);
      }
      bots.push(`Bot ${randomNum}`);
    }
    bots.forEach((bot) => {
      playerRooms.set(bot, {
        username: bot,
        roomID: data.roomID,
      });
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
      io.to(data.roomID).emit("game-status", "The game will begin shortly...");
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

          let k = 0;
          let intr = setInterval(function () {
            if (shuffledPlayers[k].includes("Bot ")) {
              let botCards = finalDeck.filter(
                (set) => set.player == shuffledPlayers[k]
              )[0].cards;
              let card = chooseCard(
                botCards.sort((a, b) => 0.5 - Math.random())
              );

              const giver = k;
              const giverIndex = finalDeck.findIndex(
                (obj) => obj.player == shuffledPlayers[giver]
              );
              let taker;
              if (giver < shuffledPlayers.length - 1) {
                taker = shuffledPlayers[giver + 1];
              } else if (giver === shuffledPlayers.length - 1) {
                taker = shuffledPlayers[0];
              }
              for (let i = 0; i < botCards.length; i++) {
                const item = botCards[i];
                if (item === card) {
                  botCards.splice(i, 1);
                  if (checkIfAllEqual(botCards)) {
                    roomsDetails.set(data.roomID, {
                      finalDeck,
                      shuffledPlayers,
                      winners: [shuffledPlayers[k]],
                    });
                    io.to(data.roomID).emit("winners", {
                      winners: [shuffledPlayers[k]],
                    });
                    clearInterval(intr);
                    return;
                    // const winners = new Set();
                    // roomsDetails.get(data.roomID).winners.forEach((w) => {
                    //   winners.add(w);
                    // });

                    // const bots = shuffledPlayers.filter((p) =>
                    //   p.includes("Bot ")
                    // );

                    // if (
                    //   bots.length !== 0 &&
                    //   roomsDetails.get(data.roomID) !== undefined
                    // ) {
                    //   let k = -1;
                    //   let intr = setInterval(() => {
                    //     k++;
                    //     if (bots[k].includes("Bot ")) {
                    //       try {
                    //         let b = bots[k];
                    //         if (
                    //           roomsDetails
                    //             .get(data.roomID)
                    //             .winners.indexOf(b) === -1
                    //         ) {
                    //           winners.add(b);
                    //           roomsDetails.set(data.roomID, {
                    //             finalDeck,
                    //             shuffledPlayers,
                    //             winners: [...Array.from(winners), b],
                    //           });
                    //         }
                    //         io.to(data.roomID).emit("winners", {
                    //           winners: Array.from(winners),
                    //         });
                    //       } catch (error) {
                    //         console.log(error);
                    //       }
                    //     }
                    //     if (k >= bots.length - 1) {
                    //       clearInterval(intr);
                    //       return;
                    //     }
                    //   }, Math.floor(Math.random() * (2000 - 1000) + 0));
                    // }
                  } else {
                    console.log("Cards arent equal");
                  }
                  break;
                }
              }
              finalDeck[giverIndex].cards = botCards;
              const takerIndex = finalDeck.findIndex(
                (obj) => obj.player == taker
              );
              let takerCards = finalDeck[takerIndex].cards;
              finalDeck[takerIndex].cards = [...takerCards, card];
              roomsDetails.set(data.roomID, {
                finalDeck: finalDeck,
                shuffledPlayers: shuffledPlayers,
                winners: [],
              });
              finalDeck.map((set) => {
                if (checkIfAllEqual(set.cards)) {
                  const socketID = Array.from(playerRooms).filter(
                    (player) => player[1].username === set.player
                  )[0][0];
                  io.to(socketID).emit("activate-win-btn", true);
                } else {
                  const socketID = Array.from(playerRooms).filter(
                    (player) => player[1].username === set.player
                  )[0][0];
                  io.to(socketID).emit("activate-win-btn", false);
                }
              });
              io.to(data.roomID).emit("game-manager", {
                finalDeck: finalDeck,
                turn: taker,
              });
              if (k === botsRequired) {
                k = 0;
              } else if (k < botsRequired) {
                k++;
              }
            } else {
              console.log("Stopped intr");
              clearInterval(intr);
            }
          }, 3000);
        } else {
          io.to(data.roomID).emit("game-status", "Joining/Creating Room");
        }
      }, 3000);
    }
  });
  socket.on("giveaway", (data) => {
    let finalDeck = roomsDetails.get(data.roomID).finalDeck;
    let shuffledPlayers = roomsDetails.get(data.roomID).shuffledPlayers;
    let giver = shuffledPlayers.indexOf(data.giver);
    let taker;
    if (giver < shuffledPlayers.length - 1) {
      taker = shuffledPlayers[giver + 1];
    } else if (giver === shuffledPlayers.length - 1) {
      taker = shuffledPlayers[0];
    }
    let giverIndex = finalDeck.findIndex((obj) => obj.player == data.giver);
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
    let takerIndex = finalDeck.findIndex((obj) => obj.player == taker);
    let takerCards = finalDeck[takerIndex].cards;
    finalDeck[takerIndex].cards = [...takerCards, data.card];
    roomsDetails.set(data.roomID, {
      finalDeck: finalDeck,
      shuffledPlayers: shuffledPlayers,
      winners: [],
    });
    finalDeck.map((set) => {
      if (checkIfAllEqual(set.cards)) {
        const socketID = Array.from(playerRooms).filter(
          (player) => player[1].username === set.player
        )[0][0];
        io.to(socketID).emit("activate-win-btn", true);
      } else {
        const socketID = Array.from(playerRooms).filter(
          (player) => player[1].username === set.player
        )[0][0];
        io.to(socketID).emit("activate-win-btn", false);
      }
    });
    io.to(data.roomID).emit("game-manager", {
      finalDeck: finalDeck,
      turn: taker,
    });
    let k = shuffledPlayers.findIndex((p) => p == taker);
    let intr = setInterval(function () {
      if (shuffledPlayers[k].includes("Bot ")) {
        let botCards = finalDeck.filter(
          (set) => set.player == shuffledPlayers[k]
        )[0].cards;

        let card = chooseCard(botCards.sort((a, b) => 0.5 - Math.random()));

        const giver = k;
        const giverIndex = finalDeck.findIndex(
          (obj) => obj.player == shuffledPlayers[giver]
        );
        let taker;
        if (giver + 1 <= shuffledPlayers.length - 1) {
          taker = shuffledPlayers[giver + 1];
        } else if (giver + 1 > shuffledPlayers.length - 1) {
          taker = shuffledPlayers[0];
        }
        for (let i = 0; i < botCards.length; i++) {
          const item = botCards[i];
          if (item === card) {
            botCards.splice(i, 1);
            if (checkIfAllEqual(botCards)) {
              roomsDetails.set(data.roomID, {
                finalDeck,
                shuffledPlayers,
                winners: [shuffledPlayers[k]],
              });
              io.to(data.roomID).emit("winners", {
                winners: [shuffledPlayers[k]],
              });
              clearInterval(intr);
              return;
              // const winners = new Set();
              // roomsDetails.get(data.roomID).winners.forEach((w) => {
              //   winners.add(w);
              // });

              // const bots = shuffledPlayers.filter((p) => p.includes("Bot "));
              // if (
              //   bots.length !== 0 &&
              //   roomsDetails.get(data.roomID) !== undefined
              // ) {
              //   console.log("got details", roomsDetails.get(data.roomID));
              //   let k = -1;
              //   let intr = setInterval(() => {
              //     k++;
              //     if (bots[k].includes("Bot ")) {
              //       let b = bots[k];
              //       if (
              //         roomsDetails.get(data.roomID).winners.indexOf(b) === -1
              //       ) {
              //         roomsDetails.set(data.roomID, {
              //           finalDeck,
              //           shuffledPlayers,
              //           winners: [...Array.from(winners), b],
              //         });
              //       }
              //       io.to(data.roomID).emit("winners", {
              //         winners: Array.from(winners),
              //       });
              //     }
              //     if (k >= bots.length - 1) {
              //       clearInterval(intr);
              //       return;
              //     }
              //   }, Math.floor(Math.random() * (1000 - 100) + 0));
              // }
            } else {
              console.log("All Are not Equal");
            }
            break;
          }
        }
        finalDeck[giverIndex].cards = botCards;
        const takerIndex = finalDeck.findIndex((obj) => obj.player == taker);
        let takerCards = finalDeck[takerIndex].cards;
        finalDeck[takerIndex].cards = [...takerCards, card];
        roomsDetails.set(data.roomID, {
          finalDeck: finalDeck,
          shuffledPlayers: shuffledPlayers,
          winners: [],
        });
        finalDeck.forEach((set) => {
          if (checkIfAllEqual(set.cards)) {
            try {
              const socketID = Array.from(playerRooms).filter(
                (player) => player[1].username === set.player
              )[0][0];
              io.to(socketID).emit("activate-win-btn", true);
            } catch (error) {
              console.log(error);
              return;
            }
          } else {
            try {
              const socketID = Array.from(playerRooms).filter(
                (player) => player[1].username === set.player
              )[0][0];
              io.to(socketID).emit("activate-win-btn", false);
            } catch (error) {
              console.log(error);
              return;
            }
          }
        });
        io.to(data.roomID).emit("game-manager", {
          finalDeck: finalDeck,
          turn: taker,
        });
        k = shuffledPlayers.findIndex((p) => p == taker);
      } else {
        console.log("Stopped intr");
        clearInterval(intr);
      }
    }, 3000);
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
        roomsDetails.get(data.roomID).winners.length !== 0) ||
      (checkIfAllEqual(data.cards) &&
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

    const bots = shuffledPlayers.filter((p) => p.includes("Bot "));
    let randomTime = Math.floor(Math.random() * (1500 - 800) + 0);
    if (bots.length !== 0) {
      let k = -1;
      let intr = setInterval(() => {
        k++;
        if (bots[k].includes("Bot ")) {
          let b = bots[k];
          if (Array.from(winners).indexOf(b) === -1) {
            winners.add(b);
            roomsDetails.set(data.roomID, {
              finalDeck,
              shuffledPlayers,
              winners: [...Array.from(winners), b],
            });
          }
          io.to(data.roomID).emit("winners", { winners: Array.from(winners) });
          randomTime = Math.floor(Math.random() * (1500 - 800) + 0);
        }
        if (k >= bots.length - 1) {
          if (playerRooms.get(socket.id)) {
            playerRooms.delete(socket.id);
          }
          if (winners.size === 4) {
            roomsDetails.delete(data.roomID);
            winners.clear();
          }
          clearInterval(intr);
          return;
        }
      }, randomTime);

      for (let index = 0; index < bots.length; index++) {
        const b = bots[index];
        playerRooms.delete(b);
      }
    }
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
