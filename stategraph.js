/*jslint node: true, newcap: true, nomen: true */

'use strict';

var EventEmitter = require('events').EventEmitter,
    _ = require('underscore');

var StateGraph, State;

function bind(fn, obj, args) {
    return _.bind.apply(_, [fn, obj].concat(args));
}

/**
 * StateGraph
 */
StateGraph = function () {
    this.states = {};
    this.current = null;
};

StateGraph.VERSION = '0.1.0';

StateGraph.prototype = {
    state: function (name, fn) {
        if (typeof name === 'undefined') {
            return this.current;
        }
        /**
         * Proxy command to sub-state
         */
        var args = _.toArray(arguments);
        if (args.length > 2) {
            return this.states[name].state.apply(this.states[name], args.slice(1));
        }
        return (this.states[name] = new State(fn, this.tree));
    },

    go: function (name) {
        var state = this.states[name];
        if (!state) {
            throw new Error('State `' + name + '` does not exist.');
        } else if (this.current === state) {
            throw new Error('Already at state `' + name + '`.');
        }
        if (this.current) {
            this.current.end();
        }
        this.current = state;
        state.enter.apply(state, _.toArray(arguments).slice(1));
        return state;
    },

    end: function () {
        if (this.current) {
            this.current.end();
        }
        /**
         * This is behavoir is for {State} objects, it's here because mixing in
         * {StateGraph} into a {State} will clobber the existing `end` method.
         * So we must reimplement the code here.
         */
        if (this._end) {
            this._end();
        }
        this.current = null;
    }
};

function multiple() {
    var self = this, args = _.toArray(arguments);
    return _.reduce(args, function (prev, fn) {
        return fn.apply(self, args);
    }, false);
}

/**
 * State
 */
State = function (fn, tree) {
    EventEmitter.call(this);

    this.tree = tree = (tree || []).concat([this]);

    /**
     * Calls the stategraph body
     * @param {Array} args List of arguments to forward to state function.
     */
    this.enter = this._enter = multiple(
        bind(this.emit, this, ['enter'].concat(tree)),
        bind(fn, this, tree)
    );

    /**
     * This method gets clobbered by the StateGraph when mixing in substates.
     */
    this.end = this._end = bind(this.emit, this, ['leave'].concat(tree));
};

State.prototype = Object.create(EventEmitter.prototype);

/**
 * Placeholder method for lazily mixing in a sub-StateGraph.
 * @return {State} Newly created sub-state
 */
State.prototype.state = function () {
    // Lazy mixin a sub StateGraph
    _.extend(this, StateGraph.prototype);
    StateGraph.call(this);
    return StateGraph.prototype.state.apply(this, arguments);
};

module.exports = StateGraph;
