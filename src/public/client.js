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
    return document.getElementById(id).value;
  }
  
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
    var width = window.innerWidth * (80*48) / (100*100);  
    var height = window.innerHeight * (90*85) / (100*100);
    
    var cellSize = Math.min( Math.floor(width/area.columns), Math.floor(height/area.rows)  );
    
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
      option.innerHTML = game.dungeons[0].config.name + " - player(s) : " + game.dungeons.length;
      gamesSelect.appendChild(option);
    });
  }
  
  function updateGameOptionsSelected() {
    var optionButtons = Array.apply(null, optionListUl.getElementsByTagName('button'));
    
    optionButtons.forEach(function (button) {
      var state = button.getAttribute('data-option-index');
      if (parseInt(state, 10) == controller.selectedOption ) {
        button.classList.add('selected');
      }
      else button.classList.remove('selected');
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
  function ClientController(socket, options) {
    this.game = new Game(socket, options);
    this.dungeonsUI = [];
    this.selectedOption = STATE_WALL;
    this.adversaries = [];
    this.adversariesPreview = [];
    this.adversaryIndex = 0;
    this.keypressed = false;
    
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
      dungeonUI.parentElement.removeChild(dungeonUI);
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
      dungeonName.innerHTML = dungeon.config.name;
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
          if (dungeonId === self.game.id) self.broadcast('ready', dungeonId);
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
      
      for(var row = 0; row < dungeon.area.rows; row++) {
        var areaRow = [];
        var randomBGRow = [];
        
        var htmlRow = createUIElement('div', { class: "row" });
        area.appendChild(htmlRow);
        
        for(var column = 0; column < dungeon.area.columns; column++) {
          
          var square = createUIElement('div', {
            class: mapStateToClass(dungeon.area.states[row][column].state),
            'data-area-x': column,
            'data-area-y': row,
            'data-dungeon-id': dungeon.id,
          }, {
            click: self.applyOptionEvent.bind(self),
          });
          
          htmlRow.appendChild(square);
          areaRow.push(square);
          randomBGRow.push(randomiseSquare());
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
      
      if(dungeon.id == self.game.id) { // not adversary
        
        document.getElementById('my-dungeon').appendChild(areaContainer);
        
      } else { // adversary
        
        document.getElementById('adversaries-dungeon').appendChild(areaContainer);
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
        
        document.getElementById('dungeon-preview').appendChild(previewContainer);
        
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
        
        // update life count
        dungeonUI.lifeCount.innerHTML = dungeon.life;
        
        // update money count
        dungeonUI.moneyCount.innerHTML = dungeon.money;
        
        // for adversaries
        if(dungeon.id != self.game.id) {
          dungeonUI.previewLifeCount.innerHTML = dungeon.life;
          dungeonUI.previewMoneyCount.innerHTML = dungeon.money;
        }
        
        // ready button
        var otherUi = find(self.dungeonsUI, dungeon.id);
        if (dungeon.player.ready) {
          otherUi.readyButton.classList.add('btn-ready');
        } else {
          otherUi.readyButton.classList.remove('btn-ready');
        }
        
        // update area state
        
        var style = getCellSize(dungeon.area);
        
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
    broadcast: function (eventName, data) {
      socket.emit(eventName, data);
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
  
    socket.on("game-l", function (rooms) {
      updateGamesList(rooms);
    });
    
    socket.on("game-created", function (newGame) {
      initClientController(newGame);
      updateGameOptions();
    });
    
    socket.on("update", function (updatedGame) {
      controller ? controller.updateGame(updatedGame) : initClientController(updatedGame); // we have to create controller when joining a game
      controller.selectAdversary(controller.adversaryIndex);
      updateGameOptions();
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

    buttons.forEach(function (button) {
      on(button, 'click', function () {
        switch (button.id) {
          case 'new-g':
            socket.emit(button.id, {
              gameId: socket.id,
              areaColumns: getValueById('ac'),
              areaRows: getValueById('ar'),
              name: getValueById('gn')
            });
            break;

          case 'join-g':
            socket.emit(button.id, {
              playerId: socket.id,
              gameId: getValueById('gl'),
              dungeonName: getValueById('gn'),
            });
            break;

          case 'refresh-gl':
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
          
          if (direction) socket.emit('move-player', direction);
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
    socket.emit('refresh-gl', { playerId: socket.id, });
  
  }
  
  window.addEventListener("load", init, false);
  
})();