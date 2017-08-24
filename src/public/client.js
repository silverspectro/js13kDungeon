"use strict";

(function() {

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

    function wipeElementsFrom(element) {
        while(element.children.length) {
            element.removeChild(element.children[element.children.length-1]);
        }
    }

    var elementsOn = {},
        startMenu = getElementById('start-menu');

    function toggle(element, force) {
        if (!elementsOn[element.id]) {
            elementsOn[element.id] = element.className.includes('off');
        }
        if (elementsOn[element.id] && !force) {
            element.classList.remove('off');
        } else {
            element.classList.add('off');
        }
    }

    var gamesList = getElementById('games-menu'),
        gamesUl = getElementById('games-list'),
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
            li.innerHTML = "id: " + game.id + "<br>"
                            + "players: " + game.dungeons.length;
            on(li, 'click', selectGame);
            gamesUl.appendChild(li);
            console.log(game.dungeons.length);
        });
    }



    var socket, //Socket.IO client
        game;

    /**
     * Binde Socket.IO and button events
     */
    function bind() {

        socket.on("room-list", function (rooms) {
            console.log(rooms);
            updateGamesList(rooms);
            toggle(gamesList);
            toggle(startMenu);
        });

        socket.on("game-created", function (newGame) {
            game = new Game(socket);
            game.updateGame(newGame);
            toggle(startMenu);
        });

        socket.on("update", function(updatedGame) {
            if (!game) game = new Game({ id: updatedGame.id });
            game.updateGame(updatedGame);
            toggle(startMenu, true);
            toggle(gamesList, true);
            console.log(updatedGame);
        });

        socket.on("error", function () {});

        var buttons = Array.prototype.slice.apply(document.getElementsByTagName('button'));

        buttons.forEach(function (button) {
            on(button, 'click', function () {
                switch(button.id) {
                    case 'join-game':
                        socket.emit(button.id, selectedGameId);
                        break;
                    default:
                        socket.emit(button.id, socket.id);
                }
            });
        })
    }

    /**
     * Client module init
     */
    function init() {
        socket = io({ upgrade: false, transports: ["websocket"] });
        bind();
    }

    window.addEventListener("load", init, false);

})();
