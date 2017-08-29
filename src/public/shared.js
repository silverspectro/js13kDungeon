"use strict";

/* -------- General Functions -------- */

/**
 * Remove an element from an array
 * @param {array} array
 * @param {element} element
 */
function remove(array, element) {
  array.splice(array.indexOf(element), 1);
}

/**
 * Find element by id in an array
 * @param {Array} array
 * @param {id} id
 * @return {element|undefined} 
 */
function find(array, id) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].id === id) return array[i];
  }
  return undefined;
}

/**
 * Find element index by id
 * @param {Array} array
 * @param {id} id
 * @return {Number|undefined} 
 */
function findIndex(array, id) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].id === id) return i;
  }
  return undefined;
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

/* -------- End General Functions -------- */