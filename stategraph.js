/*jslint node: true, newcap: true, nomen: true */
/*global _, EventEmitter */

var StateGraph = (function (_, EventEmitter, StateGraph, State, State_prototype, objectCreate) {
    'use strict';

    /**
     * Create a new object based on the old one
     * http://javascript.crockford.com/prototypal.html
     */
    if (typeof objectCreate === 'function') {
        objectCreate = objectCreate;
    } else {
        objectCreate = function (o) {
            function F() {}
            F.prototype = o;
            return new F();
        };
    }

    /**
     * Helper for currying a variadic amount of arguments.
     */
    function bind(fn, obj, args) {
        return _.bind.apply(_, [fn, obj].concat(args));
    }

    /**
     * Constructs a StateGraph, dyuh.
     *
     * @constructor StateGraph
     */
    StateGraph = function () {
        this.states = {};
        this.current = null;

        /**
         * Don't clobber the tree if it already exists, in the instance we're
         * mixing in a stategraph into a state.
         */
        if (!this.tree) {
            this.tree = [this];
        }
    };

    StateGraph.VERSION = '0.2.0';

    /**
     * Allow the user to define the emitter they want to use.
     */
    StateGraph.emitter = function (emitter) {
        EventEmitter = emitter;
        State.prototype = _.extend(objectCreate(emitter), State_prototype);
    };

    StateGraph.prototype = {
        /**
         * Creates a state, or sub‑state.
         *
         * @method state
         * @param {String}   name... Variadic amount of nested states to create
         * @param {Function} fn      Callback function to for defining the state
         * @return {object State}    The newly created state
         */
        /**
         * Find a state, or sub‑state by name.
         *
         * @method state
         * @param {String} name... Variadic list nested states
         * @return {object State}  The associated state object
         */
        state: function (name, fn) {
            var self = this, args = _.toArray(arguments);

            /**
             * Return current state if called with no arguments.
             */
            if (typeof name === 'undefined') {
                return self.current;
            }

            /**
             * Return state by name if called with only a string.
             */
            if (typeof fn === 'undefined') {
                return self.states[name];
            }

            /**
             * Proxy command to sub‑stategraph if called with more than
             * 3 arguments, because we don't know how to handle that at this
             * level.  If called with two strings, proxy to the sub‑stategraph
             * because they want to get a sub‑state by name.
             */
            if (args.length > 2 || typeof fn === 'string') {
                return self.states[name].state.apply(
                    self.states[name],
                    args.slice(1)
                );
            }

            /**
             * Was called with a name and a function, initialize a new state!
             */
            return (self.states[name] = new State(fn, self.tree));
        },

        /**
         * Move the stategraph to the desired state.  When moving to a nested
         * state, this will bubble up the stategraphs and move to the correct
         * state for each level.
         *
         * @param {String} name    Name of state to jump to
         * @param          args... Variadic list of arguments to pass to state
         * @return {object State}  The state that has been moved to
         */
        go: function (name) {
            var self = this, state;

            if (name instanceof State) {
                state = name;
            } else {
                state = self.states[name];
            }

            /**
             * Throw a nice error if they try going to a state that doesn't
             * exist.
             */
            if (!state) {
                throw new Error('State `' + name + '` does not exist.');
            }

            /**
             * Don't allow the graph to enter the state it's already at.
             */
            if (self.current === state) {
                return state;
            }

            if (self.current) {
                self.current.end();
            }

            /**
             * Move to the correct parent state!
             *
             * @todo This is pretty cheeky... clean this up!
             */
            if (self.tree.length >= 2) {
                _.chain(self.tree).last(2).reduce(function (graph, state) {
                    graph.go(state);
                });
            }

            self.current = state;
            state.enter.apply(state, _.toArray(arguments).slice(1));
            return state;
        },

        /**
         * Ends the current stategraph
         *
         * @return {object StateGraph} Returns self
         */
        end: function (self) {
            self = this;
            if (self.current) {
                self.current.end();
            }

            /**
             * When mixing in a {StateGraph} into {State} objects for
             * sub‑stategraph functionaliy, the stategraph's `end` method will
             * clobber the state's `end` method.  To make both objects end
             * happily, the state's `end` method is also attached to `_end`,
             * so call that if it exists!
             */
            if (self._end) {
                self._end();
            }

            self.current = null;
        }
    };

    /**
     * @constructor State
     */
    State = function (fn, tree) {
        var self = this;

        EventEmitter.call(self);

        self.tree = tree.concat([self]);

        /**
         * Don't pass in the initial stategraph into the argument list, we
         * only care about states!  Because state should only be stored in
         * states, not stategraphs!
         */
        tree = _.rest(self.tree);

        /**
         * Calls the stategraph body
         * @param args... Variadic arguments to forward to state function.
         */
        self.enter = self._enter = function () {
            bind(self.emit, self, ['enter'].concat(tree)).apply(self, arguments);
            bind(fn, self, tree).apply(self, arguments);
        };

        /**
         * self method gets clobbered by the StateGraph when mixing in substates.
         */
        self.end = self._end = bind(self.emit, self, ['leave'].concat(tree));
    };

    State.prototype = _.extend(objectCreate(EventEmitter.prototype), State_prototype = {
        /**
         * Placeholder method for lazily mixing in a sub‑StateGraph.
         * @return {State} Newly created sub‑state
         */
        state: function () {
            // Lazy mixin a sub StateGraph
            _.extend(this, StateGraph.prototype);
            StateGraph.call(this);
            return StateGraph.prototype.state.apply(this, arguments);
        },

        /**
         * Similar to `go` but allows you to jump to a state once you're already
         * there.  This will recursively backtrace the graphs to properly align
         * the states.
         *
         * @param args...         Varadiac list of arguments used to enter state
         * @return {object State} State object that has been jumped to
         */
        jump: function () {
            var self = this, args = _.toArray(arguments);
            return _.reduce(self.tree, function (graph, state, index) {
                graph.go.apply(graph, [state].concat(
                    self.tree.length === index + 1 ? args : []
                ));
                return state;
            });
        }
    });

    return StateGraph;
}(
    /**
     * Load underscore & EventEmitter via global namespace (browser), or by
     * requiring!
     */
    typeof _ !== 'undefined' ? _ : require('underscore'),
    typeof EventEmitter !== 'undefined' ? EventEmitter : require('events').EventEmitter
));

/**
 * Export Node.js‑style module.
 */
if (typeof module !== 'undefined') {
    module.exports = StateGraph;
}
