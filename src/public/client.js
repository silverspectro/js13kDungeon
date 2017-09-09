"use strict";

(function () {

  /* -------- General Functions -------- */

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
   * document.getElementById.value for input elements
   * @param {String} id - the id of the DOMElement
   * @return {String} 
   */
  function getValueById(id) {
    return getElementById(id).value;
  }

  /// @TODO : review this function interest (used only once)
  function randomiseSquare() {
    var random = Math.floor(Math.random() * 8);
    return random > 0 && random <= 3 ? ' bg' + random : ''; // 3 backgrounds defined, cf. css
  }

  /**
   * mapStateToClass
   * @param {Int} state - binary state
   * @return {String} css class corresponding to given state  
   */
  function mapStateToClass(state) {

    var cssClass = "square";

    if( state & STATE_PLAYER ) { cssClass += " player"; }
    if( state & STATE_WALL ) { cssClass += " wall"; }
    if( state & STATE_DYNAMITE ) { cssClass += " dynamite"; }
    if( state & STATE_MONEY ) { cssClass += " money"; }
    if( state & STATE_RHUM ) { cssClass += " rhum"; }

    return cssClass;
  }

  /**
   * Get controll label from available state
   * @param {Int} state 
   * @TODO : review this function interest (used only once)
   */
  function getStateLabel(state) {
    if( state & STATE_DYNAMITE ) return "Dynamite";
    if( state & STATE_WALL ) return "Wall";
  }

  /**
   * getCellSize
   * @param {Area} area
   * @return {Object} contening width and height of an area cell  
   */
  function getCellSize(area) {

    // rules given by css
    var width = window.innerWidth * (80/100) * (48/100);
    var height = window.innerHeight * (90/100) * (85/100);

    var cellSize = Math.min( Math.floor(width/area.columns), Math.floor(height/area.rows) );

    return {
      width: cellSize + 'px',
      height: cellSize + 'px',
    };
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

  /// @TODO : enhance according new status behavior
  function toggle(element, force) {
    elementsOn[element.id] = element.className.includes('off');
    if (elementsOn[element.id] && !force) {
      element.classList.remove('off');
    } else {
      element.classList.add('off');
    }
  }

  function updateGamesList(games) {
    wipeElementsFrom(gamesSelect);
    games.forEach(function (game) {
      var option = document.createElement('option');
      option.setAttribute('value', game.id);
      option.innerHTML = game.name + " - player(s) : " + game.dungeons.length;
      gamesSelect.appendChild(option);
    });
  }

  function updateGameOptionsSelected() {
    var optionButtons = Array.apply(null, optionListUl.getElementsByTagName('button'));

    optionButtons.forEach(function (button) {
      var state = button.getAttribute('data-option-index');
      if (parseInt(state, 10) == controller.selectedOption) {
        button.classList.add('selected');
      } else button.classList.remove('selected');
    });
  }

  function selectOption(event) {
    var optionIndex = event.target.getAttribute('data-option-index');
    controller.selectedOption = parseInt(optionIndex);
    updateGameOptionsSelected();
  }

  function updateGameOptions() {
    var config = find(controller.game.dungeons, socket.id).config;
    var options = controller.game.options;

    if(options.length <= 0) {
      throw new Error('Invalid option list for controll.')
    }

    wipeElementsFrom(optionListUl);
    if(options.indexOf(controller.selectedOption) == -1) {
      controller.selectedOption = options[0];
    }

    options.forEach(function (option) {
      var li = createUIElement('li');
      var button = createUIElement(
        'button',
        { 'data-option-index': option, },
        { click: selectOption, }
      );
      var stateName = getStateLabel(option);
      button.innerHTML = stateName + ' ' + config[stateName.toLowerCase() + 'Cost'] + '<div class="icon money"></div>';

      li.appendChild(button);
      optionListUl.appendChild(li);
    });
    updateGameOptionsSelected();
  }

  /**
   * Apply style to an elements
   * @param {DOMElement} element 
   * @param {Object} style 
   */
  function applyStyleOn(element, style) {
    for (var key in style) {
      element.style[key] = style[key];
    }
  };

  /**
   * Apply attributes to an elements
   * @param {DOMElement} element 
   * @param {Object} attributes 
   */
  function applyAttributesOn(element, attributes) {
    for (var key in attributes) {
      element.setAttribute(key, attributes[key]);
    }
  };

  function createUIElement(type, attributes, events) {
    var element = document.createElement(type);
    attributes = attributes || {};
    events = events || {};

    applyAttributesOn(element, attributes);

    for (var event in events) {
      element.addEventListener(event, events[event]);
    }

    return element;
  }

  function initClientController(game) {
    controller = new ClientController(socket);
    controller.updateGame(game);
    toggle(homeMenu, true);
    toggle(optionList);
  }

  /* -------- End General Functions -------- */


  /* -------- ClientController Class -------- */

  /**
   * ClientController Class
   * @param {socket} socket
   */
  function ClientController(socket) {
    this.id = socket.id;
    this.game;
    this.dungeonsUI = [];
    this.selectedOption = STATE_WALL;
    this.adversaries = [];
    this.adversariesPreview = [];
    this.adversaryIndex = 0;
    this.keypressed = false;

    var self = this;

    window.addEventListener('wheel', function (event) {
      self.navigateThroughAdversaries(event);
    });
  }

  ClientController.prototype = {
    updateGame: function (game) {
      this.game = game;
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
      var aIndex = this.adversaryIndex;
      if (event.deltaY < 0) {
        aIndex++;
        aIndex = (aIndex > this.adversaries.length - 1) ? 0 : aIndex;
      } else {
        aIndex--;
        aIndex = (aIndex < 0) ? (this.adversaries.length - 1) : aIndex;
      }
      this.selectAdversary(aIndex);
    },
    deleteDungeonUI: function (dungeonId) {
      var dungeonUI = getElementById(dungeonId);
      var dungeonUIPreview = getElementById('preview-' + dungeonId);

      var adversaryIndex = this.adversaries.indexOf(dungeonUI);
      this.adversaries.splice(adversaryIndex, 1);

      var adversaryPreviewIndex = this.adversariesPreview.indexOf(dungeonUIPreview);
      this.adversariesPreview.splice(adversaryPreviewIndex, 1);
      dungeonUI.parentElement.removeChild(dungeonUI);
      if (dungeonUIPreview) dungeonUIPreview.parentElement.removeChild(dungeonUIPreview);
    },
    applyOptionEvent: function (event) {
      var selectedSquare = event.target;
      var dungeonId = selectedSquare.getAttribute('data-dungeon-id');
      var x = parseInt(selectedSquare.getAttribute('data-area-x'), 10);
      var y = parseInt(selectedSquare.getAttribute('data-area-y'), 10);
      socket.emit(PLAY_EVENT_APPLY, {
        opponentId: dungeonId,
        state: this.selectedOption,
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
      dungeonName.innerHTML = dungeon.name;
      var area = createUIElement('div', {
        class: 'area',
      });
      var statusContainer = createUIElement('div', {
        class: 'status-container',
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
          if (dungeonId == self.id) socket.emit(GAME_EVENT_START);
        },
      });

      for (var l = 0; l < 3; l++) {
        area.appendChild(createUIElement('div', {
          class: 'light',
        }))
      };

      // Create the area DOM squares
      // and associate it to the new uiDungeon
      // for update loop and performance

      var style = getCellSize(dungeon.area);

      for(var row = 0; row < dungeon.area.rows; row++) {
        var areaRow = [];
        var randomBGRow = [];

        var htmlRow = createUIElement('div', { class: "row" });
        area.appendChild(htmlRow);

        for(var column = 0; column < dungeon.area.columns; column++) {

          var randomBGSquare = randomiseSquare();

          var square = createUIElement('div', {
            class: mapStateToClass(dungeon.area.states[row][column].state) + randomBGSquare,
            'data-area-x': column,
            'data-area-y': row,
            'data-dungeon-id': dungeon.id,
          }, {
            click: self.applyOptionEvent.bind(self),
          });

          applyStyleOn(square, style)

          htmlRow.appendChild(square);
          areaRow.push(square);
          randomBGRow.push(randomBGSquare);
        }

        uiDungeon.area.push(areaRow);
        randomBGMap.push(randomBGRow);
      }

      // append the elements to the DOM
      areaContainer.appendChild(readyButton);
      areaContainer.appendChild(dungeonName);
      statusContainer.appendChild(lifeCount);
      statusContainer.appendChild(moneyCount);

      areaContainer.appendChild(statusContainer);
      areaContainer.appendChild(area);

      // map the element to the uiDungeon
      uiDungeon.lifeCount = lifeCount;
      uiDungeon.moneyCount = moneyCount;
      uiDungeon.readyButton = readyButton;
      this.dungeonsUI.push(uiDungeon);

      if (dungeon.id == self.id) { // not adversary

        getElementById('my-dungeon').appendChild(areaContainer);

      } else { // adversary

        getElementById('adversaries-dungeon').appendChild(areaContainer);
        this.adversaries.push(areaContainer);

        // creating dungeon preview for opponents

        var previewContainer = createUIElement('div', {
          class: 'dungeon-preview-container',
          id: 'preview-' + dungeon.id,
          'data-dungeon-id': dungeon.id,
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

        previewContainer.appendChild(previewDungeonName);
        previewContainer.appendChild(previewLifeCount);
        previewContainer.appendChild(previewMoneyCount);

        uiDungeon.previewLifeCount = previewLifeCount;
        uiDungeon.previewMoneyCount = previewMoneyCount;

        getElementById('dungeon-preview').appendChild(previewContainer);

        this.adversariesPreview.push(previewContainer);

        var ind = this.adversariesPreview.length - 1;

        on(previewContainer, 'click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          self.selectAdversary(ind);
        });
      }

      return uiDungeon;
    },
    updateUI: function () {
      var self = this;

      // remove dungeons from ui if not in the game anymore
      this.dungeonsUI.forEach(function (dungeonUi, dungeonUiIndex) {
        if (!find(self.game.dungeons, dungeonUi.id)) {
          self.deleteDungeonUI(dungeonUi.id);
        }
      });

      // for each game dungeon, update ui if exists, create if they don't
      this.game.dungeons.forEach(function (dungeon) {
        var dungeonUI = find(self.dungeonsUI, dungeon.id);

        // create if doesn't exist
        if (!dungeonUI) {
          dungeonUI = self.addDungeonUI(dungeon);
        }

        // update if exists
        dungeonUI.lifeCount.innerHTML = dungeon.life;
        dungeonUI.moneyCount.innerHTML = dungeon.money;

        // for adversary previews
        if (dungeon.id != self.id) {
          dungeonUI.previewLifeCount.innerHTML = dungeon.life;
          dungeonUI.previewMoneyCount.innerHTML = dungeon.money;
        }

        // ready button
        // console.log(dungeon);
        (dungeon.status === D_STATUS_READY) ?
        dungeonUI.readyButton.classList.add('btn-ready'):
          dungeonUI.readyButton.classList.remove('btn-ready');

        // area
        var style = getCellSize(dungeon.area);

        // TODO : it won't work if area dimension changed
        dungeon.area.states.forEach(function (row, rowIndex) {
          row.forEach(function (column, columnIndex) {
            applyAttributesOn(dungeonUI.area[rowIndex][columnIndex], {
              class: mapStateToClass(column.state) + randomBGMap[rowIndex][columnIndex],
            });
            applyStyleOn(dungeonUI.area[rowIndex][columnIndex], style);
          });
        });

      });
    },
  }

  /* -------- End ClientController Class -------- */

  // client environment variables
  var elementsOn = {},
    randomBGMap = [],
    homeMenu = getElementById('home-menu'),
    gamesSelect = getElementById('gl'),
    optionList = getElementById('option-list'),
    optionListUl = optionList.getElementsByTagName('ul')[0],
    buttons = Array.apply(null, document.getElementsByTagName('button')),
    socket, //Socket.IO client
    controller,
    timeout,
    mouseX = 0,
    mouseY = 0;

  /**
   * Binde Socket.IO and button events
   */
  function bind() {

    socket.on(GAME_EVENT_LISTED, function (rooms) {
      updateGamesList(rooms);
    });

    socket.on(GAME_EVENT_CREATED, function (newGame) {
      initClientController(newGame);
      updateGameOptions();
    });

    // update UI anytime game edited or play updated
    socket.on(GAME_EVENT_EDITED, function (updatedGame) {
      controller ? controller.updateGame(updatedGame) : initClientController(updatedGame);
      // we have to create controller when joining a game
      controller.selectAdversary(controller.adversaryIndex);
      updateGameOptions();
    });

    /// @TODO shouldn't we manage this case ?
    // socket.on("error", function () {});

    socket.on(PLAY_EVENT_WIN, function (dungeonPayload) {
      throw new Error("TODO");
    });
    socket.on(PLAY_EVENT_LOST, function (dungeonPayload) {
      throw new Error("TODO");
    });

    socket.on(GAME_EVENT_FINISHED, function () {
      alert('Game finished');
    });

    socket.on('disconnect', function () {
      window.location.reload(true);
    });

    buttons.forEach(function (button) {
      on(button, 'click', function () {
        switch (button.id) {
          case GAME_EVENT_CREATE:
            socket.emit(button.id, {
              gameId: socket.id,
              areaColumns: getValueById('ac'),
              areaRows: getValueById('ar'),
              name: getValueById('gn')
            });
            break;

          case GAME_EVENT_JOIN:
            socket.emit(button.id, {
              playerId: socket.id,
              gameId: getValueById('gl'),
              dungeonName: getValueById('gn'),
            });
            break;

          case GAME_EVENT_LIST:
            socket.emit(button.id, {
              playerId: socket.id,
            });
            break;

          default:
            throw new Error("Un-managed button : " + button.id)
        }
      });
    });

    window.addEventListener('resize', function () {
      if (controller) controller.updateUI();
    });

    window.addEventListener('mousemove', function (event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
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
    window.addEventListener('keydown', function (event) {
      var key = event.keyCode;
      var direction;
      if (controller) {
        if (!controller.keypressed) {
          controller.keypressed = true;

          if      (key === 87 || key === 38) { direction = MOVE_UP; }
          else if (key === 40 || key === 83) { direction = MOVE_DOWN; }
          else if (key === 65 || key === 37) { direction = MOVE_LEFT; }
          else if (key === 68 || key === 39) { direction = MOVE_RIGHT; }

          if (direction) socket.emit(PLAY_EVENT_MOVE, direction);
          timeout = window.setTimeout(function (){
            controller.keypressed = false;
          }, 100);
        }
      }
    });

    window.addEventListener('keyup', function() {
      clearInterval(timeout);
      if(controller) controller.keypressed = false;
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

    // Start with current game list
    socket.emit(GAME_EVENT_LIST, { playerId: socket.id, });

  }

  window.addEventListener("load", init, false);

})();