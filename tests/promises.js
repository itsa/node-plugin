/*global describe, it, beforeEach, afterEach */
/*jshint unused:false */
(function (window) {

    "use strict";
    var expect = require('chai').expect,
        should = require('chai').should();

    require("../node-plugin.js")(window);

    describe('Promise ext', function () {

        it('Promise.finishAll with only 1 item, no array', function (done) {
            var p1 = Promise.resolve(1);
            Promise.finishAll(p1).then(
                function(response) {
                    var fulfilled = response.fulfilled,
                        rejected = response.rejected;
                    expect(fulfilled[0]).to.eql(1);
                    (rejected[0]===undefined).should.be.true;
                    done();
                }
            ).then(
                undefined,
                done
            );
        });

        it('Promise.finishAll', function (done) {
            var p1, p2, p3;
            p1 = Promise.resolve(1);
            p2 = new Promise(function(fulfill, reject) {
                setTimeout(fulfill.bind(undefined, 2), 50);
            });
            p3 = new Promise(function(fulfill, reject) {
                setTimeout(fulfill.bind(undefined, 4), 75);
            });
            Promise.finishAll([p1, p2, p3]).then(
                function(response) {
                    var fulfilled = response.fulfilled,
                        rejected = response.rejected;
                    expect((fulfilled[0]+fulfilled[1]+fulfilled[2])).to.eql(7);
                    (rejected[0]===undefined).should.be.true;
                    (rejected[1]===undefined).should.be.true;
                    (rejected[2]===undefined).should.be.true;
                    done();
                }
            ).then(
                undefined,
                done
            );
        });

        it('Promise.finishAll with rejection', function (done) {
            var p1, p2, p3;
            p1 = Promise.resolve(1);
            p2 = new Promise(function(fulfill, reject) {
                setTimeout(reject.bind(undefined, 8), 50);
            });
            p3 = new Promise(function(fulfill, reject) {
                setTimeout(fulfill.bind(undefined, 4), 75);
            });
            Promise.finishAll([p1, p2, p3]).then(
                function(response) {
                    var fulfilled = response.fulfilled,
                        rejected = response.rejected;
                    (fulfilled[1]===undefined).should.be.true;
                    expect((fulfilled[0]+fulfilled[2])).to.eql(5);
                    (rejected[0]===undefined).should.be.true;
                    (rejected[2]===undefined).should.be.true;
                    expect(rejected[1]).to.eql(8);
                    done();
                }
            ).then(
                undefined,
                done
            );
        });

        it('Promise.chainFns with only one item, no array', function (done) {
            var p1 = function(amount) {
                    return new Promise(function(resolve, reject) {
                        setTimeout(function() {
                            expect(amount).to.eql(1);
                            resolve(amount);
                        }, 50);
                    });
                };
            Promise.chainFns(p1.bind(undefined,1)).then(
                function(total) {
                    expect(total).to.eql(1);
                    done();
                }
            ).then(
                undefined,
                done
            );
        });

        it('Promise.chainFns simple', function (done) {
            var a = [], p1, p2, p3;
            p1 = function() {
                return Promise.resolve(5);
            };
            p2 = function(amount) {
                // amount===5 --> passed through by p1
                return 10*amount;
            };
            p3 = function(amount) {
                // amount===50 --> passed through by p2
                return Promise.resolve(amount*5);
            };

            a.push(p1);
            a.push(p2);
            a.push(p3);

            Promise.chainFns(a).then(
                function(total) {
                    expect(total).to.eql(250);
                    done();
                }
            );
        });

        it('Promise.chainFns complex', function (done) {
            var a = [], p1, p2, p3;
            p1 = function(amount) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        expect(amount).to.eql(1);
                        resolve(amount);
                    }, 50);
                });
            };
            p2 = function(total, amount) {
                var value = total+amount;
                expect(value).to.eql(3);
                return value;
            };
            p3 = function(total, amount) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        var value = total+amount;
                        expect(value).to.eql(7);
                        resolve(value);
                    }, 50);
                });
            };
            a.push(p1.bind(undefined, 1));
            a.push(p2.bind(undefined, 2));
            a.push(p3.bind(undefined, 4));
            Promise.chainFns(a).then(
                function(total) {
                    expect(total).to.eql(7);
                    done();
                }
            ).then(
                undefined,
                done
            );
        });

        it('Promise.chainFns with rejection', function (done) {
            var a = [], p1, p2, p3, p3Invoked = false;
            p1 = function(amount) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        expect(amount).to.eql(1);
                        resolve(amount);
                    }, 50);
                });
            };
            p2 = function(total, amount) {
                var value = total+amount;
                expect(value).to.eql(3);
                return value;
            };
            p3 = function(total, amount) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        var value = total+amount;
                        p3Invoked = true;
                        expect(value).to.eql(7);
                        resolve(value);
                    }, 50);
                });
            };
            a.push(p1.bind(undefined, 1));
            a.push(p2.bind(undefined, 2));
            a.push(Promise.reject);
            a.push(p3.bind(undefined, 4));
            Promise.chainFns(a).then(
                function(total) {
                    done(new Error('chainFn resolved when it should have been rejected'));
                },
                function(total) {
                    expect(total).to.eql(3);
                }
            );
            setTimeout(function() {
                p3Invoked.should.be.false;
                done();
            }, 200);
        });

        it('Promise.chainFns with rejection and finishAll', function (done) {
            var a = [], p1, p2, p3;
            p1 = function(amount) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        expect(amount).to.eql(1);
                        reject(amount);
                    }, 50);
                });
            };
            p2 = function(total, amount) {
                var value = total+amount;
                expect(value).to.eql(3);
                return value;
            };
            p3 = function(total, amount) {
                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        var value = total+amount;
                        expect(value).to.eql(7);
                        resolve(value);
                    }, 50);
                });
            };
            a.push(p1.bind(undefined, 1));
            a.push(p2.bind(undefined, 2));
            a.push(p3.bind(undefined, 4));
            Promise.chainFns(a, true).then(
                function(total) {
                    expect(total).to.eql(7);
                    done();
                }
            ).then(
                undefined,
                done
            );
        });

        it('Promise.finally on fulfilled promise', function (done) {
            var p = new Promise(function(resolve, reject) {
                setTimeout(function() {
                    resolve();
                }, 50);
            });
            p.finally(done);
        });

        it('Promise.finally on rejected promise', function (done) {
            var p = new Promise(function(resolve, reject) {
                setTimeout(function() {
                    reject();
                }, 50);
            });
            p.finally(done);
        });

        it('Typeof Promise.finally', function (done) {
            (Promise.resolve().finally(function() {}) instanceof Promise).should.be.true;
            setTimeout(done, 25);
        });

        it('Promise.thenFulfill', function () {
            var p1 = Promise.resolve(),
                p2 = Promise.reject();
            return p1.then(p2).thenFulfill().should.be.fulfilled;
        });

        it('Promise.thenFulfill manually thrown error', function () {
            var p1 = Promise.resolve();
            return p1
            .then(
                function() {
                    throw new Error();
                }
            )
            .thenFulfill().should.be.fulfilled;
        });

        it('Promise.manage make fulfilled', function () {
            var promise = Promise.manage();
            setTimeout(function() {
                promise.fulfill();
            }, 10);
            return promise.should.be.fulfilled;
        });

        it('Promise.manage make rejected', function () {
            var promise = Promise.manage();
            setTimeout(function() {
                promise.reject();
            }, 10);
            return promise.should.be.rejected;
        });

        it('Promise.manage callback before fulfilled', function () {
            var count = 0,
                promise;
            promise = Promise.manage(
                function(extra) {
                    count += extra;
                }
            );
            setTimeout(function() {
                promise.callback(1);
            }, 25);
            setTimeout(function() {
                promise.callback(2);
            }, 50);
            setTimeout(function() {
                expect(count).to.eql(3);
            }, 75);
            setTimeout(function() {
                promise.fulfill();
            }, 100);
            return promise.should.be.fulfilled;
        });

        it('Promise.manage callback after fulfilled', function (done) {
            var count = 0,
                promise;
            promise = Promise.manage(
                function() {
                    done(new Error('callback should not be invoked'));
                }
            );
            setTimeout(function() {
                promise.callback();
            }, 50);
            setTimeout(function() {
                promise.fulfill();
            }, 10);
            setTimeout(function() {
                done();
            }, 75);
        });

    });


}(global.window || require('node-win')));