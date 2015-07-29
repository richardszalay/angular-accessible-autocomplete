
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

	function AutocompleteDirectiveObject(markup, scope) {
		this.scope = scope;

		this.element = $compile('<div>' + markup + '</div>')(scope);

		this.input = this.element.find('input');

		// Required for promise-based template load
		scope.$digest();

		this.list = this.element.find('ul');
	}

	AutocompleteDirectiveObject.prototype.enterText = function(text) {
		this.input.val(text);
		this.input.triggerHandler('input');

		this.scope.$digest();
	}

	AutocompleteDirectiveObject.prototype.waitForSuggestions = function() {
		$timeout.flush();
		this.scope.$apply();
	}	

	AutocompleteDirectiveObject.prototype.triggerKeyboardEvent = function(eventName, keyData) {
		var e = new window.KeyboardEvent(eventName, {
		  bubbles: true,
		  cancelable: true,
		  shiftKey: true
		});

		for (var prop in keyData) {
			delete e[prop];
			Object.defineProperty(e, prop, {'value': keyData[prop]});
		}

		this.input[0].dispatchEvent(e);

		this.scope.$digest();
	}

	var keys = {
		escape: { keyCode: 27, which: 27 },
		enter: { keyCode: 13, which: 13 },
		tab: { keyCode: 9, which: 9 },
		down: { keyCode: 40, which: 40 },
		up: { keyCode: 38, which: 38 },
	};

	var sut = null;

	describe('when list completion is enabled', function() {

		describe('and the input changes but is less than the minimum length', function() {

			beforeEach(inject(function() {
				$scope.suggestions = sinon.spy(function() {
					return ['abc1', 'abc2', 'abc3'];
				});

				sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="3" />', $scope);
				sut.enterText('ab');
			}));

			it('should not populate the suggestions list', function() {
				expect($scope.suggestions.callCount).to.equal(0);
			});
		});

		describe('and input changes', function() {
			describe('and a previous delay has not elapsed', function() {
				beforeEach(function() {
					$scope.suggestions = sinon.spy(function() {
						return ['abc1', 'abc2', 'abc3'];
					});


					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					sut.enterText('abc');
					sut.enterText('abc');
					sut.waitForSuggestions();
				});

				it('should abort the original query', function() {
					expect($scope.suggestions.calledOnce).to.be.true;
				});
			});

			describe('and a delay is configured', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					sut.enterText('abc');
				});

				it('should delay before querying', function() {
					expect(sut.list.children('ul').length).to.equal(0);
					
					sut.waitForSuggestions();
					expect(sut.list.children('ul').length).to.equal(5);
				});
			});

			describe('and the query returns a list', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					sut.enterText('abc');
					sut.waitForSuggestions();
				});

				it('should populate the suggestions list', function() {
					expect(sut.list.children('ul').length).to.equal(5);
					expect(sut.list.hasClass('ng-hide')).to.be.false;
				});
			});

			describe('and the query returns a promise', function() {
				beforeEach(function() {
					$scope.suggestions = function() { return $q.when(['abc1', 'abc2', 'abc3', 'abc4', 'abc5']); };
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					sut.enterText('abc');
					sut.waitForSuggestions();
				});

				it('should use the result of the promise as suggestions', function() {
					expect(sut.list.children('ul').length).to.equal(5);
					expect(sut.list.hasClass('ng-hide')).to.be.false;
				});
			});
			
			describe("and the suggestions return undefined", function() {
				beforeEach(function() {
					$scope.suggestions = function() { return $q.when(undefined); };
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					sut.enterText('abc');
					sut.waitForSuggestions();
				});
			
				it('should hide the suggestions list', function() {
					expect(sut.list.children('ul').length).to.equal(0);
					expect(sut.list.hasClass('ng-hide')).to.be.true;
				});
			});
			
			describe("and the suggestions return a non-array", function() {
				beforeEach(function() {
					$scope.suggestions = function() { return $q.when({ clearly: "not-an-array" }); };
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);
					sut.enterText('abc');
					sut.waitForSuggestions();
				});
			
				it('should hide the suggestions list', function() {
					expect(sut.list.children('ul').length).to.equal(0);
					expect(sut.list.hasClass('ng-hide')).to.be.true;
				});
			});
		});

		describe('when the escape key is pressed', function() {
			describe('and the suggestions list is currently displayed', function() {
				beforeEach(function() {
					$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);

					sut.enterText('abc');
					sut.waitForSuggestions();

					sut.triggerKeyboardEvent('keydown', keys.escape);
				});

				it('should hide the suggestions list', function() {
					expect(sut.list.hasClass('ng-hide')).to.be.true;
				});

				it('should cancel the current selection', function() {
					expect(sut.list[0].querySelectorAll('*[aria-selected=true]').length).to.equal(0);
				});
			});
		});

		describe('when the up key is pressed', function() {
			beforeEach(function() {
				$scope.suggestions = ['abc1', 'abc2', 'abc3', 'abc4', 'abc5'];
				sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" autocomplete-minimum="0" />', $scope);

				sut.enterText('abc');
				sut.waitForSuggestions();
			});

			describe('and the list is not visible', function() {
				beforeEach(function() {
					sut.triggerKeyboardEvent('keydown', keys.escape);

					sut.triggerKeyboardEvent('keydown', keys.up);
				});

				it('should display the list', function() {
					expect(sut.list.hasClass('ng-hide')).to.be.false;
				});
			});

			describe('and the first suggestion is selected', function() {
				beforeEach(function() {
					sut.triggerKeyboardEvent('keydown', keys.up);
				});

				it('should select the last suggestion', function() {
					var children = sut.list.children();

					expect(children.eq(children.length-1).attr('aria-selected')).to.equal('true');
				});
			});

			describe('and the last suggestion is selected', function() {
				beforeEach(function() {
					sut.triggerKeyboardEvent('keydown', keys.up);

					sut.triggerKeyboardEvent('keydown', keys.up);
				});

				it('should select the second last suggestion', function() {
					var children = sut.list.children();

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
				sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions"  autocomplete-minimum="0" />', $scope);

				sut.enterText('abc');
				sut.waitForSuggestions();
			});

			describe('and the list is not visible', function() {
				beforeEach(function() {
					sut.triggerKeyboardEvent('keydown', keys.escape);
					sut.triggerKeyboardEvent('keydown', keys.down);
				});

				it('should display the list', function() {
					expect(sut.list.hasClass('ng-hide')).to.be.false;
				});
			});

			describe('and the first suggestion is selected', function() {
				beforeEach(function() {
					sut.triggerKeyboardEvent('keydown', keys.down);
				});

				it('should select the second suggestion', function() {
					expect(sut.list.children().eq(1).attr('aria-selected')).to.equal('true');
				});
			});

			describe('and the last suggestion is selected', function() {
				beforeEach(function() {
					sut.triggerKeyboardEvent('keydown', keys.up);
					sut.triggerKeyboardEvent('keydown', keys.down);
				});

				it('should select the first suggestion', function() {
					expect(sut.list.children().eq(0).attr('aria-selected')).to.equal('true');
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
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					sut.enterText('abc');
					sut.waitForSuggestions();

					sut.triggerKeyboardEvent('keydown', keys.enter);
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
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					sut.enterText('abcd');
					sut.waitForSuggestions();

					sut.triggerKeyboardEvent('keydown', keys.enter);
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
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					sut.enterText('abc');
					sut.waitForSuggestions();

					sut.triggerKeyboardEvent('keydown', keys.enter);
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
					sut = new AutocompleteDirectiveObject('<input type="text" accessible-autocomplete="suggestions" accessible-autocomplete-selected="onSelected" />', $scope);

					sut.enterText('abcd');
					sut.waitForSuggestions();

					sut.triggerKeyboardEvent('keydown', keys.tab);
				});

				it('should not fire the selected handler', function() {
					expect($scope.onSelected.called).to.be.false;
				});
			});
		});
		
		
	});
});