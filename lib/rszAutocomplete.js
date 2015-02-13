(function() {
	'use strict';

	angular.module('rszAutocomplete', [])
		.provider('RszAutocomplete', RszAutocompleteProvider)
		.factory('rszSerialTimeout', rszSerialTimeout)
		.factory('rszSerialPromise', rszSerialPromise)
		.service('RszAutocompleteKeyProcessor', RszAutocompleteKeyProcessor)
		.directive('rszAutocomplete', RszAutocompleteDirective)

	function RszAutocompleteProvider() {
		this.defaultOptions = {
			template: '<ul class="rs-autocomplete" role="listbox" ng-show="showSuggestions" id="{{suggestionsListId}}"> ' +
				'<li ng-repeat="suggestion in suggestions" ' +
				'    id="{{suggestionsListId + \'-\' + $index}}" ' +
				'    role="option" aria-selected="{{$index == selectedSuggestionIndex}}" ' +
				'    ng-bind="suggestion" ' +
				'    ng-click="selectSuggestion(suggestion)" ' +
				'></li>' +
				'</ul>',
			mininumLength: 3,
			delay: 100
		};

		var provider = this;

		this.$get = function() {
			return provider;
		};
	}

	function RszAutocompleteDirective($compile, RszAutocomplete, RszAutocompleteKeyProcessor) {

		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				// TODO: Apply aria attributes if missing

				var ariaAutocomplete = element.attr('aria-autocomplete'),
					ariaRole = element.attr('role');

				if (!ariaAutocomplete) {
					ariaAutocomplete = (ariaRole == 'textbox') ? 'inline' : 'list';
					element.attr('aria-autocomplete', ariaAutocomplete);
				}

				if (!attrs.role) {
					ariaRole = (ariaAutocomplete == 'list' || ariaAutocomplete == 'both')
						? 'combobox' : 'textbox';

					element.attr('role', ariaRole);
				}

				// TODO: Accessible 'activation'
				element.on('keydown', function(event) {
					scope.$apply(function() {
						if (RszAutocompleteKeyProcessor.isEscape(event)) {
							scope.hideSuggestions();
							event.preventDefault();
						} else if (RszAutocompleteKeyProcessor.isDown(event)) {
							scope.moveSelectionSuggestionIndex(1);
							event.preventDefault();
						} else if (RszAutocompleteKeyProcessor.isUp(event)) {
							scope.moveSelectionSuggestionIndex(-1);
							event.preventDefault();
						} else if (RszAutocompleteKeyProcessor.isEnter(event)) {
							if (scope.showSuggestions) {
								scope.selectSuggestion(scope.selectedSuggestion);

								event.preventDefault();
							}
						}
					});
				});

				element.on('keyup', function() {
					scope.$apply(function() {
						scope.textInput = element.val();
					});
				});

				scope.options.suggestionsSelector = scope.$eval(attrs.rszAutocomplete);

				if (ariaAutocomplete == 'list' || ariaAutocomplete == 'both') {
					scope.suggestionsListId = 'rsz-autocomplete-' + (new Date()).getTime();
					scope.suggestionsList = $compile(scope.options.template)(scope);
					//scope.suggestionsListId = scope.suggestionsList.attr('id');

					element.after(scope.suggestionsList);

					element.attr('aria-owns', scope.suggestionsListId);

					scope.suggestionsList.on('keydown', function(event) {

					});
				}

				if (ariaAutocomplete == 'inline' || ariaAutocomplete == 'both') {
					// TODO: Inline support
				}

				scope.$watch('showSuggestions', function(newValue, oldValue) {
					element.attr('aria-expanded', newValue);
				});

				scope.$watch('selectedSuggestionIndex', function(newValue) {
					if (newValue == -1) {
						element.attr('aria-activedescendant', null);
					} else {
						element.attr('aria-activedescendant', scope.getSuggestionId(newValue));
					}
				});

				scope.$watch('isLoadingSuggestions', function(newValue) {
					element.attr('aria-busy', newValue === true);
				});

				scope.$watch('textInput', function(newValue, oldValue) {
					if (typeof newValue == 'undefined')
						return;

					element.val(newValue);

					if (document.activeElement != element[0]) {
						element[0].focus();
					}
				});
			},
			unlink: function(scope, element) {
				// TODO: Less conflict-prone 
				element.$off('keydown');

				scope.suggestionsList.remove();
				scope.suggestionsList = null;
			},
			controller: RszAutocompleteController
		};
	}

	function RszAutocompleteKeyProcessor() {
		return {
			isEscape: function(event) {
				return event.keyCode === 27;
			},
			isDown: function(event) {
				return event.keyCode === 40;
			},
			isUp: function(event) {
				return event.keyCode == 38;
			},
			isEnter: function(event) {
				return event.keyCode == 13;
			}
		};
	}

	function RszAutocompleteController($scope, rszSerialTimeout, rszSerialPromise, RszAutocomplete) {
		$scope.options = RszAutocomplete.defaultOptions;

		$scope.textInput = '';

		$scope.suggestions = [];
		$scope.showSuggestions = false;
		$scope.selectedSuggestion = null;
		$scope.selectedSuggestionIndex = -1;

		// TODO: defaultOptions via provider 

		var serialTimeout = rszSerialTimeout();
		var serialPromise = rszSerialPromise();

		if (typeof $scope.options.suggestionsSelector != 'function')
			$scope.options.suggestionsSelector = function() { return []; };

		$scope.hideSuggestions = function() {
			$scope.showSuggestions = false;
		};

		$scope.moveSelectionSuggestionIndex = function(delta) {
			if (!$scope.showSuggestions) {
				if ($scope.suggestions.length > 0) {
					$scope.showSuggestions = true;
				}

				return;
			}

			var newIndex = loopIndex($scope.selectedSuggestionIndex + delta, $scope.suggestions.length);

			$scope.selectedSuggestionIndex = newIndex;
			$scope.selectedSuggestion = $scope.suggestions[newIndex];
		};

		function loopIndex(newIndex, length) {
			if (newIndex < 0)
				return length - 1;
			else if (newIndex >= length)
				return 0;
			else
				return newIndex;
		}

		function replaceSuggestions(suggestions) {
			$scope.suggestions = suggestions;
			$scope.selectedSuggestion = null;
			$scope.selectedSuggestionIndex = -1;
			$scope.showSuggestions = (suggestions.length > 0);
		}

		$scope.selectSuggestion = function(suggestion) {
			$scope.selectedSuggestion = suggestion;
			$scope.selectedSuggestionIndex = $scope.suggestions.indexOf(suggestion);
			$scope.showSuggestions = false;
			$scope.textInput = formatSuggestion(suggestion);
		}

		$scope.textChanged = function(newText) {
			var normalizedInput = newText||'';

			$scope.selectedSuggestion = null;
			$scope.selectedSuggestionIndex = -1;

			if ($scope.options.mininumLength && normalizedInput.length < $scope.options.mininumLength)
				return;

			serialTimeout(null, $scope.options.delay)
				.then(function() {
					$scope.isLoadingSuggestions = true;

					return $scope.options.suggestionsSelector(normalizedInput);
				})
				.then(function(data) {
					$scope.isLoadingSuggestions = false;

					// TODO: Data formats
					$scope.suggestions = data;
					$scope.isLoadingSuggestions = false;
					$scope.showSuggestions = true;
				}, function(err) {
					$scope.isLoadingSuggestions = false;
					if (err === 'cancelled')
						return;

					// TODO: Handle errors
				});
		};

		function formatSuggestion(suggestion) {
			return (suggestion||{}).toString();
		}

		$scope.$watch('textInput', function(newValue, oldValue) {
			if ($scope.selectedSuggestion && newValue == formatSuggestion($scope.selectedSuggestion))
				return;

			$scope.textChanged(newValue);
		});

		$scope.getSuggestionId = function(index) {
			return $scope.suggestionsListId + '-' + index;
		};
	}

	function rszSerialTimeout($timeout) {
		return function() {
			var currentTimeout = null;

			return function(callback, delay) {
				if (currentTimeout != null) {
					$timeout.cancel(currentTimeout);
				}

				return (currentTimeout = $timeout(function(){}, delay));
			}
		}
	}

	function rszSerialPromise($q) {
		return function() {
			var latestDefer = null;

			return function(promise) {
				latestDefer = $q.defer();

				return (function(thisDefer) {
					return promise.then(function(data) {
						if (thisDefer === latestDefer) {
							return data;
						}

						return $q.reject('cancelled');
					});
				})(latestDefer);
			}
		};
	}
})();