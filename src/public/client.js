"use strict";

(function () {

  /**
   * Add an event to a DOM element
   * @param {DOMElement} element - the element who listen
   * @param {String} eventName - the name of the event
   * @param {Function} callback - the function to execute
   */
  function on(element, eventName, callback) {
    return element.addEventListener(eventName, callback);
  }

  /**
   * document.getElementById
   * @param {String} id - the id of the DOMElement
   * @return {DOMELement} 
   */
  function getElementById(id) {
    return document.getElementById(id);
  }

  /**
   * Wipes all element from a given DOMElement
   * @param {DOMElement} element 
   */
  function wipeElementsFrom(element) {
    while (element.children.length) {
      element.removeChild(element.children[element.children.length - 1]);
    }
  }

  var elementsOn = {},
    startMenu = getElementById('start-menu');

  function toggle(element, force) {
    elementsOn[element.id] = element.className.includes('off');
    if (elementsOn[element.id] && !force) {
      element.classList.remove('off');
    } else {
      element.classList.add('off');
    }
  }

  var gamesList = getElementById('games-menu'),
    gamesUl = getElementById('games-list'),
    optionList = getElementById('option-list'),
    optionListUl = optionList.getElementsByTagName('ul')[0],
    selectedGameId;

  function updateGameListUI() {
    var listArray = Array.prototype.slice.apply(gamesUl.children);
    listArray.forEach(function (li) {
      if (li.getAttribute('data-game-id') === selectedGameId) li.classList.add('selected')
      else li.classList.remove('selected');
    });
  }

  function selectGame(event) {
    selectedGameId = event.target.getAttribute('data-game-id');
    updateGameListUI();
  }

  function updateGamesList(games) {
    wipeElementsFrom(gamesUl);
    games.forEach(function (game) {
      var li = document.createElement('li');
      li.setAttribute('data-game-id', game.id);
      li.innerHTML = "id: " + game.id + "<br>" +
        "players: " + game.dungeons.length;
      on(li, 'click', selectGame);
      gamesUl.appendChild(li);
    });
  }


  function updateGameOptionsSelected() {
    var optionButtons = Array.prototype.slice.apply(optionListUl.getElementsByTagName('button'));

    optionButtons.forEach(function (button) {
      var dataIndex = button.getAttribute('data-option-index');
      if (parseInt(dataIndex, 10) === parseInt(selectedOption, 10)) button.classList.add('selected');
      else button.classList.remove('selected');
    });

    game.selectedOption = game.options[selectedOption];
  }

  function selectOption(event) {
    var optionIndex = event.target.getAttribute('data-option-index');
    selectedOption = optionIndex;
    updateGameOptionsSelected();
  }

  function updateGameOptions(options) {
    wipeElementsFrom(optionListUl);
    options.forEach(function (option, index) {
      var li = createUIElement('li');
      var button = createUIElement('button', {
        'data-option-index': index,
      }, {
        click: selectOption,
      });
      button.innerHTML = option;

      li.appendChild(button);
      optionListUl.appendChild(li);
    });
    if (typeof selectedOption === 'undefined') {
      selectedOption = 0;
    }
    updateGameOptionsSelected();
  }

  /* -------- Game Class -------- */
  
  /**
   * Game Class
   * @param {socket} socket
   */
  function Game(socket, options) {
    this.room = socket;
    this.id = this.room.id;
    this.dungeons = [];
    this.dungeonsUI = [];
    this.clock = false;
    this.started = false;
    this.time = 0;
    this.options = options || [
      'Wall',
      'Trap',
    ];
  }

  Game.prototype = {
    updateGame: function (game) {
      this.options = game.options;
      this.updateDungeons(game.dungeons);
    },
    updateDungeons: function (dungeons) {
      var self = this;
      var index = Math.max(Math.max(self.dungeons.length - 1, dungeons.length - 1), 0);
      var dungeonsToAdd = [];

      function treatDungeons() {
        var dungeon = dungeons[index];
        var refIndex = dungeon ? findIndex(self.dungeons, dungeon.id) : undefined;
        var refDungeon = refIndex >= 0 ? self.dungeons[refIndex] : undefined;
        if (refDungeon && dungeon && refDungeon.id === dungeon.id) {
          refDungeon.area = dungeon.area;
          refDungeon.life = dungeon.life;
          refDungeon.money = dungeon.money;
          refDungeon.player = dungeon.player;
        } else if (!refDungeon && dungeon) {
          self.dungeons.push(dungeon);
          if (!self.isServer) self.addDungeonUI(dungeon);
        } else if (self.dungeons[index] && !dungeon && !find(dungeons, self.dungeons[index].id)) {
          var deletedDungeon = self.dungeons.splice(index, 1)[0];
          self.dungeonsUI.splice(index, 1);
          if (!self.isServer) self.deleteDungeonUI(deletedDungeon.id);
        }
        index--;

        if (index < 0) {
          return;
        } else {
          treatDungeons();
        }
      }
      treatDungeons();
      if (!self.isServer) self.updateUI();
    },
    deleteDungeonUI: function (dungeonId) {
      var dungeonUI = document.getElementById(dungeonId);
      document.getElementsByTagName('main')[0].removeChild(dungeonUI);
    },
    applyOptionEvent: function (event) {
      var selectedSquare = event.target;
      var dungeonId = selectedSquare.getAttribute('data-dungeon-id');
      var x = parseInt(selectedSquare.getAttribute('data-area-x'), 10);
      var y = parseInt(selectedSquare.getAttribute('data-area-y'), 10);
      var dungeon = find(this.dungeons, dungeonId);
      this.broadcast('apply-option', {
        dungeonId: dungeonId,
        opponentId: this.id,
        option: ' ' + this.selectedOption.toLowerCase(),
        x: x,
        y: y,
      });
    },
    addDungeonUI: function (dungeon) {
      var self = this;
      var uiDungeon = {
        id: dungeon.id,
        area: [],
      };

      // initialize the UI elements

      var areaContainer = createUIElement('div', {
        class: 'area-container',
        id: dungeon.id,
      });
      var dungeonName = createUIElement('h1', {
        class: 'dungeon-name',
      });
      var area = createUIElement('div', {
        class: 'area',
      });
      var lifeContainer = createUIElement('div', {
        class: 'life-container',
      });
      var lifeBar = createUIElement('div', {
        class: 'life-bar',
      });
      var lifeCount = createUIElement('p', {
        class: 'life-count',
      });
      var moneyCount = createUIElement('p', {
        class: 'money-count',
      });
      var readyButton = createUIElement('div', {
        class: 'ready',
        'data-dungeon-id': dungeon.id,
      }, {
        click: function (event) {
          var dungeonId = event.target.getAttribute('data-dungeon-id');
          if (dungeonId === self.id) self.broadcast('ready', dungeonId);
        },
      });

      // Create the area DOM squares
      // and associate it to the new uiDungeon
      // for update loop and performance

      dungeon.area.forEach(function (row, rowIndex) {
        var areaRow = [];
        row.forEach(function (squareState, columnIndex) {
          var square = createUIElement('div', {
            class: squareState,
            'data-area-x': rowIndex,
            'data-area-y': columnIndex,
            'data-dungeon-id': dungeon.id,
          }, {
            click: self.applyOptionEvent.bind(self),
          });
          area.appendChild(square);
          areaRow.push(square);
        });
        uiDungeon.area.push(areaRow);
      });

      // append the elements to the DOM
      lifeContainer.appendChild(lifeBar);
      lifeContainer.appendChild(lifeCount);
      lifeContainer.appendChild(moneyCount);

      areaContainer.appendChild(dungeonName);
      areaContainer.appendChild(lifeContainer);
      areaContainer.appendChild(readyButton);
      areaContainer.appendChild(area);

      document.getElementsByTagName('main')[0].appendChild(areaContainer);

      // map the element to the uiDungeon
      uiDungeon.lifeBar = lifeBar;
      uiDungeon.lifeCount = lifeCount;
      uiDungeon.moneyCount = moneyCount;
      uiDungeon.readyButton = readyButton;
      this.dungeonsUI.push(uiDungeon);
    },
    updateUI: function (game) {
      var self = this;
      this.dungeons.forEach(function (dungeon, index) {
        const dungeonUI = find(self.dungeonsUI, dungeon.id);
        // update lifeBar height
        applyStyleOn(self.dungeonsUI[index].lifeBar, {
          height: dungeon.life + '%',
        });

        // update life count
        dungeonUI.lifeCount.innerHTML = dungeon.life;

        // update money count
        dungeonUI.moneyCount.innerHTML = dungeon.money;

        // ready button
        var otherUi = find(self.dungeonsUI, dungeon.id);
        if (dungeon.player.ready) {
          otherUi.readyButton.classList.add('btn-ready');
        } else {
          otherUi.readyButton.classList.remove('btn-ready');
        }

        // update area state
        dungeon.area.forEach(function (row, rowIndex) {
          row.forEach(function (column, columnIndex) {
            applyAttributesOn(dungeonUI.area[rowIndex][columnIndex], {
              class: column.state,
            });
            applyStyleOn(dungeonUI.area[rowIndex][columnIndex], column.style);
          });
        });
      });
    },
    broadcast: function (eventName, data) {
      this.room.emit(eventName, data);
    },
    toJSON: function () {
      return {
        id: this.id,
        area: this.area,
        life: this.life,
        money: this.money,
        lastUpdateTime: this.lastUpdateTime,
        player: this.player,
        config: this.config,
        modifiers: this.modifiers,
      };
    },
  }

  /* -------- End Game Class -------- */



  var socket, //Socket.IO client
    game,
    selectedOption = 0,
    mouseX = 0,
    mouseY = 0;

  /**
   * Binde Socket.IO and button events
   */
  function bind() {

    socket.on("room-list", function (rooms) {
      updateGamesList(rooms);
      toggle(gamesList);
      toggle(startMenu);
    });

    socket.on("game-created", function (newGame) {
      game = new Game(socket);
      game.updateGame(newGame);
      updateGameOptions(game.options);
      toggle(startMenu);
      optionList.classList.remove('off');
    });

    socket.on("update", function (updatedGame) {
      if (!game) game = new Game(socket);
      game.updateGame(updatedGame);
      var dungeon = find(game.dungeons, socket.id);
      toggle(startMenu, true);
      toggle(gamesList, true);
      if (game.options.length) updateGameOptions(game.options);
    });

    socket.on("error", function () {});

    socket.on('game-lost', function (data) {
      alert(data.message);
      socket.disconnect(false);
    });

    var buttons = Array.prototype.slice.apply(document.getElementsByTagName('button'));

    // add events to button based on id

    buttons.forEach(function (button) {
      on(button, 'click', function () {
        switch (button.id) {
          case 'join-game':
            socket.emit(button.id, selectedGameId);
            break;
          default:
            socket.emit(button.id, socket.id);
        }
      });
    });

    window.addEventListener('mousemove', function (event) {
      mouseX = event.screenX;
      mouseY = event.screenY;
    });

    window.addEventListener('contextmenu', function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggle(optionList);
      if (elementsOn[optionList.id]) {
        var x = mouseX;
        var y = mouseY;
        optionList.style.left = x + 'px';
        optionList.style.top = y + 'px';
      }
    });

    // add keyboard events
    window.addEventListener('keyup', function (event) {
      var key = event.keyCode;
      var direction;
      if (game) {
        if (key === 87 || key === 38) {
          direction = 'up';
        } else if (key === 40 || key === 83) {
          direction = 'down';
        } else if (key === 65 || key === 37) {
          direction = 'left';
        } else if (key === 68 || key === 39) {
          direction = 'right';
        }
        if (direction) socket.emit('move-player', direction);
      }
    });
  }

  /**
   * Client module init
   */
  function init() {
    socket = io({
      upgrade: false,
      transports: ["websocket"]
    });
    bind();
  }

  window.addEventListener("load", init, false);

})();