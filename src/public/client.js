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

    controller.selectedOption = controller.game.options[selectedOption];
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

  /* -------- ClientController Class -------- */

  /**
   * ClientController Class
   * @param {socket} socket
   */
  function ClientController(socket, options) {
    this.game = new Game(socket, options);
    this.dungeonsUI = [];
    this.adversaries = [];
    this.adversariesPreview = [];
    this.adversaryIndex = 0;
    this.selectedOption = "";

    var self = this;

    window.addEventListener('wheel', function(event) {
      self.navigateThroughAdversaries(event);
    });
  }

  ClientController.prototype = {
    updateGame: function (game) {
      this.game.options = game.options;
      this.updateDungeons(game.dungeons);
      this.updateUI();
    },
    selectAdversary: function(index) {
      var self = this;
      this.adversaries.forEach(function (adversary, ind) {
        if (index !== ind) {
          adversary.classList.remove('selected');
          self.adversariesPreview[ind].classList.remove('selected');
        } else {
          adversary.classList.add('selected');
          self.adversariesPreview[ind].classList.add('selected');
        }
      });
    },
    navigateThroughAdversaries: function(event) {
      if (event.deltaY < 0) {
        this.adversaryIndex += 1;
        this.adversaryIndex = this.adversaryIndex > this.adversaries.length - 1 ? 0 : this.adversaryIndex;
      } else {
        this.adversaryIndex -= 1;
        this.adversaryIndex = this.adversaryIndex < 0 ? this.adversaries.length - 1 : this.adversaryIndex;
      }
      this.selectAdversary(this.adversaryIndex);
    },
    updateDungeons: function (dungeons) {

      var self = this;
      var maxIndex = Math.max(Math.max(self.game.dungeons.length - 1, dungeons.length - 1), 0);
      var dungeonsToAdd = [];

      function treatDungeons(index) {

        if (index < 0) {
          return;
        }

        var dungeon = dungeons[index];
        var refDungeon = dungeon ? find(self.game.dungeons, dungeon.id) : undefined;

        if (refDungeon && dungeon && refDungeon.id === dungeon.id) {
          refDungeon.area = dungeon.area;
          refDungeon.life = dungeon.life;
          refDungeon.money = dungeon.money;
          refDungeon.player = dungeon.player;

        } else if (!refDungeon && dungeon) {
          self.game.dungeons.push(dungeon);

          // UI specific
          self.addDungeonUI(dungeon);

        } else if (self.game.dungeons[index] && !dungeon && !find(dungeons, self.game.dungeons[index].id)) {
          var deletedDungeon = self.game.dungeons.splice(index, 1)[0];
          self.dungeonsUI.splice(index, 1);

          // UI specific
          self.deleteDungeonUI(deletedDungeon.id);
        }

        treatDungeons(--index);
      }

      treatDungeons(maxIndex);
    },
    deleteDungeonUI: function (dungeonId) {
      var dungeonUI = document.getElementById(dungeonId);
      var adversaryIndex = this.adversaries.indexOf(dungeonUI);
      var dungeonUIPreview = document.getElementById('preview-' + dungeonId);
      var adversaryPreviewIndex = this.adversariesPreview.indexOf(dungeonUIPreview);
      this.adversaries.splice(adversaryIndex, 1);
      this.adversariesPreview.splice(adversaryPreviewIndex, 1);
      document.getElementsByTagName('main')[0].removeChild(dungeonUI);
      document.getElementById('dungeon-preview').removeChild(dungeonUIPreview);
    },
    applyOptionEvent: function (event) {
      var selectedSquare = event.target;
      var dungeonId = selectedSquare.getAttribute('data-dungeon-id');
      var x = parseInt(selectedSquare.getAttribute('data-area-x'), 10);
      var y = parseInt(selectedSquare.getAttribute('data-area-y'), 10);
      var dungeon = find(this.game.dungeons, dungeonId);
      this.broadcast('apply-option', {
        dungeonId: dungeonId,
        opponentId: this.game.id,
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
      dungeonName.innerHTML = dungeon.id;
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
          if (dungeonId === self.game.id) self.broadcast('ready', dungeonId);
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

      // creating dungeon preview
      var previewContainer = createUIElement('div', {
        class: 'dungeon-preview-container',
        id: 'preview-' + dungeon.id,
        'data-dungeon-id': dungeon.id,
      });
      var previewLifeContainer = createUIElement('div', {
        class: 'life-container',
      });
      var previewLifeBar = createUIElement('div', {
        class: 'life-bar',
      });
      var previewLifeCount = createUIElement('p', {
        class: 'life-count',
      });
      var previewMoneyCount = createUIElement('p', {
        class: 'money-count',
      });
      var previewDungeonName = createUIElement('p', {
        class: 'dungeon-name',
      });
      previewDungeonName.innerHTML = dungeon.id;

      previewLifeContainer.appendChild(previewLifeBar);
      previewLifeContainer.appendChild(previewLifeCount);
      previewLifeContainer.appendChild(previewMoneyCount);

      previewContainer.appendChild(previewDungeonName);
      previewContainer.appendChild(previewLifeContainer);

      uiDungeon.previewLifeBar = previewLifeBar;
      uiDungeon.previewLifeCount = previewLifeCount;
      uiDungeon.previewMoneyCount = previewMoneyCount;

      document.getElementById('dungeon-preview').appendChild(previewContainer);

      // map the element to the uiDungeon
      uiDungeon.lifeBar = lifeBar;
      uiDungeon.lifeCount = lifeCount;
      uiDungeon.moneyCount = moneyCount;
      uiDungeon.readyButton = readyButton;
      this.dungeonsUI.push(uiDungeon);

      if (this.dungeonsUI.length > 1) {
        this.adversaries.push(areaContainer);
        this.adversariesPreview.push(previewContainer);

        var ind = this.adversariesPreview.length - 1;

        on(previewContainer, 'click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          self.selectAdversary(ind);
        });
      }
      
    },
    updateUI: function () {
      var self = this;
      this.game.dungeons.forEach(function (dungeon, index) {
        const dungeonUI = find(self.dungeonsUI, dungeon.id);
        // update lifeBar height
        applyStyleOn(self.dungeonsUI[index].lifeBar, {
          height: dungeon.life + '%',
        });
        applyStyleOn(self.dungeonsUI[index].previewLifeBar, {
          width: dungeon.life + '%',
        });

        // update life count
        dungeonUI.lifeCount.innerHTML = dungeon.life;
        dungeonUI.previewLifeCount.innerHTML = dungeon.life;

        // update money count
        dungeonUI.moneyCount.innerHTML = dungeon.money;
        dungeonUI.previewMoneyCount.innerHTML = dungeon.money;

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
      socket.emit(eventName, data);
    },
  }

  /* -------- End ClientController Class -------- */


  var socket, //Socket.IO client
      controller,
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
      controller = new ClientController(socket);
      controller.updateGame(newGame);
      updateGameOptions(controller.game.options);
      toggle(startMenu);
      optionList.classList.remove('off');
    });

    socket.on("update", function (updatedGame) {
      if (!controller) controller = new ClientController(socket);
      controller.updateGame(updatedGame);
      var dungeon = find(controller.game.dungeons, socket.id);
      toggle(startMenu, true);
      toggle(gamesList, true);
      if (controller.game.options.length) updateGameOptions(controller.game.options);
      if (controller.adversaries.length === 0) controller.selectAdversary(0);
    });

    socket.on("error", function () {});

    socket.on('game-lost', function (data) {
      var message = '';
      if (data.dungeonId === socket.id) {
        message = 'You Lost';
        alert(message);
        socket.disconnect(false);
        window.location.reload(true);
      } else {
        message = data.dungeonId + ' lost the game';
        alert(message);
      }
    });

    var buttons = Array.prototype.slice.apply(document.getElementsByTagName('button'));

    // add events to button based on id

    buttons.forEach(function (button) {
      var halfXScreen = window.innerWidth / 2;
      var width = (halfXScreen * 80) / 100;
      var height = (window.innerHeight * 80) / 100;
      on(button, 'click', function () {
        switch (button.id) {
          case 'join-game':
            socket.emit(button.id, {
              gameId: selectedGameId,
              areaWidth: width,
              areaHeight: height,
            });
            break;
          default:
            socket.emit(button.id, {
              gameId: socket.id,
              areaWidth: width,
              areaHeight: height,
            });
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
      if (controller) {

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