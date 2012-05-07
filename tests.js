/*jslint node: true, newcap: true, nomen: true */

'use strict';

var StateGraph = require('./stategraph'),
    test = require('tap').test;

function args(list) {
    return Array.prototype.slice.call(list, 0);
}

test('test stategraph', function (t) {
    var q = [], a, b, c, d, graph = new StateGraph();

    // construct a
    a = graph.state('a', function (self) {
        q.push(['+a'].concat(args(arguments).slice(1)).join(':'));
        t.equal(a, self, 'state callback should pass in self');
    });

    t.equal(graph.states.a, a);

    t.equal(a.on('end', function (self) {
        q.push('-a');
        t.equal(a, self, 'state exit callback should pass in self');
    }), a, 'binding events should return the same obj for chaining');

    // graph movement
    t.equal(graph.go('a', 'foo', 'bar'), a, 'go method should return the new state obj');

    try {
        graph.go('a');
    } catch (e) {
        t.equal(e.message, 'Already at state `a`.');
    }

    t.equal(graph.state(), a, 'state method should return current state obj');
    t.equal(graph.end(), undefined, 'end method should return nothing useful');

    // construct more states
    b = graph.state('b', function (self) {
        q.push(['+b'].concat(args(arguments).slice(1)).join(':'));
        t.equal(b, self, 'state callback should pass in self');
    }).on('end', function (self) {
        q.push('-b');
        t.equal(b, self, 'state exit callback should pass in self');
    });

    c = graph.state('c', function () {
        q.push(['+c'].concat(args(arguments).slice(1)).join(':'));
    }).on('end', function () {
        q.push('-c');
    });

    d = graph.state('d', function () {
        q.push(['+d'].concat(args(arguments).slice(1)).join(':'));
    }).on('end', function () {
        q.push('-d');
    });

    // movement
    t.equal(b, graph.go('b', 'foo'));
    t.equal(b, graph.state());
    t.equal(a, graph.go('a'));
    t.equal(a, graph.state());
    t.equal(d, graph.go('d', 1, 2, 3));
    t.equal(d, graph.state());
    t.equal(c, graph.go('c', null));
    t.equal(c, graph.state());
    graph.end();
    graph.go('c', false, 'foo');
    t.equal(c, graph.state());

    // non-existant state
    try {
        graph.go('foobar');
    } catch (e2) {
        t.equal(e2.message, 'State `foobar` does not exist.');
    }

    // test movement
    t.equal(
        q.join(','),
        '+a:foo:bar,-a,+b:foo,-b,+a,-a,+d:1:2:3,-d,+c:,-c,+c:false:foo',
        'make sure states entered/exited in the order they were called.'
    );
    t.end();
});

test('test substates', function (t) {
    var q = [], a, a_1, a_2, b, graph = new StateGraph();

    // define graph
    a = graph.state('a', function (self_a) {
        q.push(['+a'].concat(args(arguments).slice(1)).join(':'));
        t.equal(a, self_a);
    }).on('end', function (self_a) {
        q.push('-a');
        t.equal(a, self_a);
    });
    t.equal(graph.states.a, a);
    t.equal(graph.states.a.states, undefined);

    a_1 = graph.state('a', '1', function (self_a, self_a_1) {
        q.push(['+a_1'].concat(args(arguments).slice(2)).join(':'));
        t.equal(a, self_a);
        t.equal(a_1, self_a_1);
    }).on('end', function (self_a, self_a_1) {
        q.push('-a_1');
        t.equal(a, self_a);
        t.equal(a_1, self_a_1);
    });
    t.equal(graph.states.a.states['1'], a_1);

    a_2 = graph.state('a', '2', function (self_a, self_a_2) {
        q.push(['+a_2'].concat(args(arguments).slice(2)).join(':'));
        t.equal(a, self_a);
        t.equal(a_2, self_a_2);
    }).on('end', function (self_a, self_a_2) {
        q.push('-a_2');
        t.equal(a, self_a);
        t.equal(a_2, self_a_2);
    });
    t.equal(graph.states.a.states['2'], a_2);

    // movement
    t.equal(graph.state(), undefined);
    t.equal(graph.go('a'), a);
    t.equal(graph.state(), a);
    t.equal(graph.state().state(), undefined);
    t.equal(graph.state().go('1'), a_1);
    t.equal(graph.state().state(), a_1);
    t.equal(graph.state().go('2'), a_2);
    t.equal(graph.state().state(), a_2);
    graph.end();
    t.equal(graph.state(), undefined);

    // define more states
    b = graph.state('b', function (self) {
        q.push(['+b'].concat(args(arguments).slice(1)).join(':'));
        t.equal(b, self);
    }).on('end', function () {
        q.push('-b');
    });

    // movement
    t.equal(graph.go('b', 'foo', 'bar'), b);
    t.equal(graph.state(), b);
    t.equal(graph.go('a'), a);
    t.equal(graph.state(), a);
    t.equal(graph.state().state(), undefined);
    t.equal(graph.state().go('2', 1, 2, 3), a_2);
    t.equal(graph.state().state(), a_2);
    t.equal(graph.state().go('1', null, false), a_1);
    t.equal(graph.state().state(), a_1);
    t.equal(graph.state().go('2'), a_2);
    t.equal(graph.state().state(), a_2);
    t.equal(graph.go('b', 1), b);
    t.equal(graph.state(), b);
    graph.end();
    t.equal(graph.state(), undefined);

    // test movement
    t.equal(
        q.join(','),
        ('+a,+a_1,-a_1,+a_2,-a_2,-a,+b:foo:bar,-b,+a,+a_2:1:2:3,-a_2,' +
         '+a_1::false,-a_1,+a_2,-a_2,-a,+b:1,-b')
    );

    t.end();
});
