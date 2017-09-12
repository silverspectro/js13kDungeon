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
    if( state & STATE_BOUM ) { cssClass += " boum"; }
    
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
  function toggle(element, setOn) {
    setOn = (typeof(setOn) === "boolean") ? setOn : element.className.includes('off');
    elementsOn[element.id] = setOn;
    setOn ? element.classList.remove('off') : element.classList.add('off');
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
    this.selectedAdversary;
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
    
    selectAdversary: function (adversaryId) {
      var self = this;

      // ensure to always have adversaryId defined properly
      /// @todo Too heavy ! Review this init process
      adversaryId = adversaryId || self.selectedAdversary;
      var iterator = 0;
      while (!adversaryId && iterator < self.dungeonsUI.length) {
        var currentDungeonId = self.dungeonsUI[iterator].id
        if( currentDungeonId != self.id ) adversaryId = currentDungeonId;
        iterator++;
      }
      
      if(self.id == adversaryId) throw new Error("Invalid id selected for adversary.");

      var selectedDungeonUI = find(self.dungeonsUI, self.selectedAdversary);
      if(selectedDungeonUI) {
        selectedDungeonUI.dungeonElt.classList.remove('selected');
        selectedDungeonUI.dungeonPreviewElt.classList.remove('selected');
      }

      self.selectedAdversary = adversaryId;
      selectedDungeonUI = find(self.dungeonsUI, adversaryId);
      if(selectedDungeonUI) {
        selectedDungeonUI.dungeonElt.classList.add('selected');
        selectedDungeonUI.dungeonPreviewElt.classList.add('selected');
      }
    },

    navigateThroughAdversaries: function (event) {
      var dungeonListLength = this.dungeonsUI.length;
      if(dungeonListLength < 2) return;

      // @todo : too heavy, how to make it simpler ?
      var aIndex = findIndex(this.dungeonsUI, this.selectedAdversary);
      var selfIndex = findIndex(this.dungeonsUI, this.id);

      do {
        (event.deltaY < 0) ? aIndex++ : aIndex--;
        aIndex = (aIndex > dungeonListLength - 1) ? 0 : aIndex;
        aIndex = (aIndex < 0) ? (dungeonListLength - 1) : aIndex;
      } while (aIndex == selfIndex);

      this.selectAdversary(this.dungeonsUI[aIndex].id);
    },
    
    /// @TODO : check if all elements well supressed
    deleteDungeonUI: function (dungeonUI) {
      [
        dungeonUI.dungeonElt,
        dungeonUI.dungeonPreviewElt,
        dungeonUI.statusElt,
      ].forEach( function(elt) {
        elt.parentElement.removeChild(elt);
      });

      var dungeonUiIndex = this.dungeonsUI.indexOf(dungeonUI);
      this.dungeonsUI.splice(dungeonUiIndex, 1);

      if (this.selectedAdversary == dungeonUI.id) this.selectedAdversary = undefined;
      this.selectAdversary(); // ensure first join is selected
    },
    applyOptionEvent: function (event) {
      var selectedSquare = event.target;
      var dungeonId = selectedSquare.getAttribute('data-dungeon-id');
      var x = parseInt(selectedSquare.getAttribute('data-area-x'), 10);
      var y = parseInt(selectedSquare.getAttribute('data-area-y'), 10);
      socket.emit(PLAY_EVENT_APPLY, {
        opponentId: dungeonId,
        state: controller.selectedOption,
        x: x,
        y: y,
      });
    },
    addDungeonUI: function (dungeon) {
      var self = this;
      var uiDungeon = new UiDungeon(self, dungeon);

      self.dungeonsUI.push(uiDungeon);

      getElementById("m-status").appendChild(uiDungeon.statusElt);
      
      if (dungeon.id == self.id) { // not adversary
        getElementById('m-panel').appendChild(uiDungeon.dungeonElt);

      } else { // adversary
        getElementById('a-panels').appendChild(uiDungeon.dungeonElt);
        getElementById('a-previews').appendChild(uiDungeon.dungeonPreviewElt);

        on(uiDungeon.dungeonPreviewElt, 'click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          self.selectAdversary(uiDungeon.id);
        });
        
        self.selectAdversary(); // ensure first join is selected
      }
    },
    updateUI: function () {
      var self = this;

      // remove dungeons from ui if not in the game anymore
      self.dungeonsUI.forEach(function (dungeonUi) {
        if (!find(self.game.dungeons, dungeonUi.id)) {
          self.deleteDungeonUI(dungeonUi);
        }
      });

      // for each game dungeon, update ui if exists, create if they don't
      self.game.dungeons.forEach(function (dungeon) {
        var dungeonUI = find(self.dungeonsUI, dungeon.id);

        // update if exists, else create
        dungeonUI ? dungeonUI.updateFromDungeon(dungeon) : self.addDungeonUI(dungeon);
      });

      self.updateUIFromSTatus();

      self.selectAdversary(self.selectedAdversary); // keep it at the end cause of status usage as class
    },
    updateUIFromSTatus: function () {
      var self = this;

      var gameStatus = self.game.status
      var selfDungeon = find(self.game.dungeons, self.id)

      mainCtrl.className = gameStatus;
      myPanel.className = selfDungeon.status;
      setupMenu.className = selfDungeon.status;

      if(gameStatus == G_STATUS_SETUP) {
        toggle(homeMenu, false);
        toggle(optionList, false);
        
      } else if(self.game.status == G_STATUS_RUNNING) {
        toggle(homeMenu, false);

      } else if(self.game.status == G_STATUS_FINISHED) {
        toggle(homeMenu, false);
        toggle(optionList, false);
        
      } else {
        throw new Error("Unknown game status.");
      }
    }
  }

  /* -------- End ClientController Class -------- */

  // client environment variables
  var elementsOn = {},
    homeMenu = getElementById('home-menu'),
    mainCtrl = getElementById('main-ctrl'),
    setupMenu = getElementById('m-setup'),
    myPanel = getElementById('m-panel'),
    adversaryPanels = getElementById('a-panels'),
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

    socket.on(GAME_EVENT_STARTED, function () {
      toggle(optionList);
    });

    // update UI anytime game edited or play updated
    // we have to create controller when joining a game
    socket.on(GAME_EVENT_EDITED, function (updatedGame) {
      controller ? controller.updateGame(updatedGame) : initClientController(updatedGame);
      updateGameOptions();
    });

    /// @TODO shouldn't we manage this case ?
    // socket.on("error", function () {});

    socket.on(GAME_EVENT_FINISHED, function (updatedGame) {
      controller.updateGame(updatedGame);
    });

    socket.on('disconnect', function () {
      window.location.reload(true);
    });

    buttons.forEach(function (button) {
      on(button, 'click', function () {
        switch (button.id) {
          case GAME_EVENT_CREATE:
            socket.emit(button.id, {
              areaColumns: getValueById('ac'),
              areaRows: getValueById('ar'),
              name: getValueById('gn')
            });
            break;

          case GAME_EVENT_JOIN:
            socket.emit(button.id, {
              gameId: getValueById('gl'),
            });
            break;

          case GAME_EVENT_START:
            socket.emit(button.id, {
              name: getValueById('dn'),
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
        optionList.style.left = mouseX + 'px';
        optionList.style.top = mouseY + 'px';
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
          timeout = window.setTimeout(function () {
            controller.keypressed = false;
          }, 100);
        }
      }
    });

    window.addEventListener('keyup', function () {
      clearInterval(timeout);
      if (controller) controller.keypressed = false;
    });
  }


  /* -------- UiDungeon Class -------- */

  /**
   * UiDungeon Class
   * @param {Dungeon} dungeon
   */
  function UiDungeon(controller, dungeon) {
    this.id = dungeon.id;
    this.randomBGMap = [];
    this.style;
    
    // Dom area cells elements mapped in order to make update fast & simple
    this.area = [];

    // Dom elements mapped in order to make update simple
    /// @TODO : associate dom elements by information 'type' (life, money, status, name) 
    //          to make update / create more consistent and simpler 
    this.dungeonElt;
    this.nameElt;
    this.lifeCountElt;
    this.moneyCountElt;

    this.dungeonPreviewElt;
    this.previewDungeonName;
    this.previewLifeCountElt;
    this.previewMoneyCountElt;

    this.statusElt;
    this.statusNameElt;
    this.statusLifeCountElt;
    this.statusMoneyCountElt;

    // initialize dom elements
    // @TODO make it generic
    this.init(dungeon);
  }

  UiDungeon.prototype = {
    updateFromDungeon: function (dungeon) {
      var self = this;

      // update name
      self.nameElt.innerHTML = dungeon.name;
      self.previewDungeonName.innerHTML = dungeon.name;
      self.statusNameElt.innerHTML = dungeon.name;

      // update life
      self.lifeCountElt.innerHTML = dungeon.life;
      self.previewLifeCountElt.innerHTML = dungeon.life;
      self.statusLifeCountElt.innerHTML = dungeon.life;
      
      // update money
      self.moneyCountElt.innerHTML = dungeon.money;
      self.previewMoneyCountElt.innerHTML = dungeon.money;
      self.statusMoneyCountElt.innerHTML = dungeon.money;

      // update status
      self.dungeonElt.className = dungeon.status;
      self.statusElt.className = dungeon.status;
      self.dungeonPreviewElt.className = dungeon.status;

      // make game responsive
      self.style = getCellSize(dungeon.area);
      
      // TODO : it won't work if area dimension changed
      dungeon.area.states.forEach(function (row, rowIndex) {
        row.forEach(function (column, columnIndex) {
          applyAttributesOn(self.area[rowIndex][columnIndex], {
            class: mapStateToClass(column.state) + self.randomBGMap[rowIndex][columnIndex],
          });
          applyStyleOn(self.area[rowIndex][columnIndex], self.style);
        });
      });
    },
    init: function (dungeon) {
      // build dom elements and map them
      this.createDungeonElt(dungeon);
      this.createDungeonPreviewElt(dungeon);
      this.createStatusElt(dungeon);
      
      // set dom elements values
      this.updateFromDungeon(dungeon);
    },
    createDungeonElt: function (dungeon) {
      var self = this;

      // for simplicity section element is reserved for dungeon containers
      /// @TODO enhance class / status management, use data attribute ?
      self.dungeonElt = createUIElement('section', {
        id: dungeon.id,
      });

      var dungeonName = createUIElement('h1');

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

      for (var l = 0; l < 3; l++) {
        area.appendChild(createUIElement('div', {
          class: 'light',
        }))
      };

      // Create the area DOM squares and associate it to uiDungeon
      // (update loop and performance)

      for (var row = 0; row < dungeon.area.rows; row++) {
        var areaRow = [];
        var randomBGRow = [];

        var htmlRow = createUIElement('div', {
          class: "row"
        });
        area.appendChild(htmlRow);

        for (var column = 0; column < dungeon.area.columns; column++) {

          var randomBGSquare = randomiseSquare();
          var boum = createUIElement('div', { class: 'boum', });

          var square = createUIElement('div', {
            class: mapStateToClass(dungeon.area.states[row][column].state) + randomBGSquare,
            'data-area-x': column,
            'data-area-y': row,
            'data-dungeon-id': dungeon.id,
          }, {
            click: controller.applyOptionEvent.bind(self),
          });

          square.appendChild(boum);
          applyStyleOn(square, self.style)

          htmlRow.appendChild(square);
          areaRow.push(square);
          randomBGRow.push(randomBGSquare);
        }

        self.area.push(areaRow);
        self.randomBGMap.push(randomBGRow);
      }

      // append the elements to the DOM
      statusContainer.appendChild(lifeCount);
      statusContainer.appendChild(moneyCount);

      self.dungeonElt.appendChild(dungeonName);
      self.dungeonElt.appendChild(statusContainer);
      self.dungeonElt.appendChild(area);

      // map the element to uiDungeon
      self.nameElt = dungeonName;
      self.lifeCountElt = lifeCount;
      self.moneyCountElt = moneyCount;

    },
    createDungeonPreviewElt: function (dungeon) {
      var self = this;

      self.dungeonPreviewElt = createUIElement('div', {
        'data-dungeon-id': dungeon.id,
      });
      self.previewLifeCountElt = createUIElement('p', {
        class: 'life-count',
      });
      self.previewMoneyCountElt = createUIElement('p', {
        class: 'money-count',
      });
      self.previewDungeonName = createUIElement('h2');

      self.dungeonPreviewElt.appendChild(self.previewDungeonName);
      self.dungeonPreviewElt.appendChild(self.previewLifeCountElt);
      self.dungeonPreviewElt.appendChild(self.previewMoneyCountElt);
    },

    createStatusElt: function (dungeon) {
      
      var self = this;
      
      self.statusElt = createUIElement('div', {
        'data-dungeon-id': dungeon.id,
      });

      self.statusNameElt = createUIElement('h2');
      self.statusLifeCountElt = createUIElement('p', { class: 'life-count', });
      self.statusMoneyCountElt = createUIElement('p', { class: 'money-count', });
      var previewStatusElt = createUIElement('p', { class: 'status', });

      self.statusElt.appendChild(self.statusNameElt);
      self.statusElt.appendChild(self.statusLifeCountElt);
      self.statusElt.appendChild(self.statusMoneyCountElt);
      self.dungeonPreviewElt.appendChild(previewStatusElt);

      /// @TODO : add some texts to enlight status playing / win / lose     },
    },
  }

  /* -------- End UiDungeon Class -------- */



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