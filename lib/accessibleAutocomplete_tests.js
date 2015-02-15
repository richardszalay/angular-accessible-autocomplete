
function sendKeys(input, keys) {

}

describe("accessibleAutocomplete", function() {
	beforeEach(module('accessibleAutocomplete'));

	var $controller, $compile, $rootScope, $timeout, $q, $scope;

	beforeEach(inject(function(_$controller_, _$compile_, _$rootScope_, _$timeout_, _$q_){
		$controller = _$controller_;
		$compile = _$compile_;
		$rootScope = _$rootScope_;
		$timeout = _$timeout_;
		$q = _$q_;

		$scope = $rootScope.$new();
	}));

	var element, input, list;

	function compileDirective(markup, scope) {
		element = $compile('<div>' + markup + '</div>')(scope);

		input = element.find('input');
		list = element.find('ul');
	}

	function enterText(text) {
		input.val(text);
		input.triggerHandler('input');
		$scope.$digest();
	}

	function triggerKeyboardEvent(eventName, keyData) {
		var e = new window.KeyboardEvent(eventName, {
		  bubbles: true,
		  cancelable: true,
		  shiftKey: true
		});

		for (var prop in keyData) {
			delete e[prop];
			Object.defineProperty(e, prop, {'value': keyData[prop]});
		}

		input[0].dispatchEvent(e);
	}

	var keys = {
		escape: { keyCode: 27, which: 27 },
		enter: { keyCode: 13, which: 13 },
		tab: { keyCode: 9, which: 9 },
		down: { keyCode: 40, which: 40 },
		up: { keyCode: 38, which: 38 },
	};

	describe('when list completion is enabled', function() {

		describe('and the input is changes but is less than the minimum length', function() {

			beforeEach(inject(function() {
				$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];

				compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="3" />', $scope);

				input.val('ab');
			}));

			it('should not populate the suggestions list', function() {
				$timeout.verifyNoPendingTasks();
			});
		});

		describe('and input changes', function() {
			describe('and a previous delay has not elapsed', function() {
				beforeEach(function() {
					$scope.suggestions = sinon.spy(function() {
						return ['abc1', 'abc2', 'abc3'];
					});
					compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					enterText('abc');
				});

				it('should abort the original query', function() {
					$timeout.flush();
					expect($scope.suggestions.calledOnce).to.be.true;
				});
			});

			describe('and a delay is configured', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					enterText('abc');
				});

				it('should delay before querying', function() {
					expect(list.children('ul').length).to.equal(0);
					$timeout.flush();
					expect(list.children('ul').length).to.equal(5);
				});
			});

			describe('and the query returns a list', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					enterText('abc');
				});

				it('should populate the suggestions list', function() {
					$timeout.flush();
					$scope.$digest();

					expect(list.children('ul').length).to.equal(5);
					expect(list.hasClass('ng-hide')).to.be.false;
				});
			});

			describe('and the query returns a promise', function() {
				beforeEach(function() {
					$scope.suggestions = function() { return $q.when(['abc1', 'abc2', 'abc3', 'abc4', 'abc5']); };
					compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					enterText('abc');
				});

				it('should use the result of the promise as suggestions', function() {
					$timeout.flush();
					$scope.$digest();

					expect(list.children('ul').length).to.equal(5);
					expect(list.hasClass('ng-hide')).to.be.false;
				});
			});
		});

		describe('when the escape key is pressed', function() {
			describe('and the suggestions list is currently displayed', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);

					enterText('abc');
					$timeout.flush();

					triggerKeyboardEvent('keydown', keys.escape);
					$scope.$digest();
				});

				it('should hide the suggestions list', function() {
					expect(list.hasClass('ng-hide')).to.be.true;
				});

				it('should cancel the current selection', function() {
					expect(list[0].querySelectorAll('*[aria-selected=true]').length).to.equal(0);
				});
			});
		});

		describe('when the up key is pressed', function() {
			beforeEach(function() {
				$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
				compileDirective('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);

				enterText('abc');
				$timeout.flush();
			});

			describe('and the list is not visible', function() {
				beforeEach(function() {
					triggerKeyboardEvent('keydown', keys.escape);
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.up);
					$scope.$digest();
				});

				it('should display the list', function() {
					expect(list.hasClass('ng-hide')).to.be.false;
				});
			});

			describe('and the first suggestion is selected', function() {
				beforeEach(function() {
					triggerKeyboardEvent('keydown', keys.up);
					$scope.$digest();
				});

				it('should select the last suggestion', function() {
					var children = list.children();

					expect(children.eq(children.length-1).attr('aria-selected')).to.equal('true');
				});
			});

			describe('and the last suggestion is selected', function() {
				beforeEach(function() {
					triggerKeyboardEvent('keydown', keys.up);
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.up);
					$scope.$digest();
				});

				it('should select the second last suggestion', function() {
					var children = list.children();

					expect(children.eq(children.length-2).attr('aria-selected')).to.equal('true');
				});
			});
		});

		describe('when the down key is pressed', function() {
			beforeEach(function() {
				$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
				$scope.onSelected = function(val) {
					$scope.capturedSelectedSuggestion = val;
				};
				compileDirective('<input type="text" accessible-autocomplete="suggestions"  autocomplete-minimum="0" />', $scope);

				enterText('abc');
				$timeout.flush();
			});

			describe('and the list is not visible', function() {
				beforeEach(function() {
					triggerKeyboardEvent('keydown', keys.escape);
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.down);
					$scope.$digest();
				});

				it('should display the list', function() {
					expect(list.hasClass('ng-hide')).to.be.false;
				});
			});

			describe('and the first suggestion is selected', function() {
				beforeEach(function() {
					triggerKeyboardEvent('keydown', keys.down);
					$scope.$digest();
				});

				it('should select the second suggestion', function() {
					expect(list.children().eq(1).attr('aria-selected')).to.equal('true');
				});
			});

			describe('and the last suggestion is selected', function() {
				beforeEach(function() {
					triggerKeyboardEvent('keydown', keys.up);
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.down);
					$scope.$digest();
				});

				it('should select the first suggestion', function() {
					expect(list.children().eq(0).attr('aria-selected')).to.equal('true');
				});
			});
		});

		describe('when the enter key is pressed', function() {
			describe('and there is a selected suggestion', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					$scope.onSelected = function(val, index) {
						$scope.capturedSelectedSuggestion = val;
						$scope.capturedSelectedSuggestionIndex = index;
					};
					compileDirective('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					enterText('abc');
					$timeout.flush();
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.enter);
					$scope.$digest();
				});

				it('should fire the selected handler with the selected item', function() {
					expect($scope.capturedSelectedSuggestion).to.equal('abc1');
					expect($scope.capturedSelectedSuggestionIndex).to.equal(0);
				});
			});

			describe('and there is no selected suggestion', function() {
				beforeEach(function() {
					$scope.suggestions = [];
					$scope.onSelected = function(val, index) {
						$scope.capturedSelectedSuggestion = val;
						$scope.capturedSelectedSuggestionIndex = index;
					};
					compileDirective('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					enterText('abcd');
					$timeout.flush();
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.enter);
					$scope.$digest();
				});

				it('should fire the selected handler with the entered text', function() {
					expect($scope.capturedSelectedSuggestion).to.equal('abcd');
					expect($scope.capturedSelectedSuggestionIndex).to.equal(-1);
				});
			});
		});

		describe('when the tab key is pressed', function() {
			describe('and there is a selected suggestion', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					$scope.onSelected = function(val, index) {
						$scope.capturedSelectedSuggestion = val;
						$scope.capturedSelectedSuggestionIndex = index;
					};
					compileDirective('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					enterText('abc');
					$timeout.flush();
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.enter);
					$scope.$digest();
				});

				it('should fire the selected handler with the selected item', function() {
					expect($scope.capturedSelectedSuggestion).to.equal('abc1');
					expect($scope.capturedSelectedSuggestionIndex).to.equal(0);
				});
			});

			describe('and there is no selected suggestion', function() {
				beforeEach(function() {
					$scope.suggestions = [];
					$scope.onSelected = sinon.spy();
					compileDirective('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					enterText('abcd');
					$timeout.flush();
					$scope.$digest();

					triggerKeyboardEvent('keydown', keys.tab);
					$scope.$digest();
				});

				it('should not fire the selected handler', function() {
					expect($scope.onSelected.called).to.be.false;
				});
			});
		});
	});
});