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
			template: '<ul class="rs-autocomplete" role="listbox" aria-expanded="{{showSuggestions}}" ng-show="showSuggestions" id="{{suggestionsListId}}"> ' +
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
						} else if (RszAutocompleteKeyProcessor.isEnter(event) ||
					       RszAutocompleteKeyProcessor.isTab(event)) {
							if (scope.showSuggestions) {
								scope.selectSuggestion(scope.selectedSuggestion);

								event.preventDefault();
							}
						}
					});
				});

				element.on('keyup', function() {
					scope.$apply(function() {
						if (element.val() != scope.textInput + scope.textInputSuffix)
							scope.textChanged(element.val());
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

				scope.$watch(function() {
					return '['+scope.textInput+']['+scope.textInputSuffix+']';
				}, function(newValue, oldValue) {
					if (typeof newValue == 'undefined')
						return;

					if (ariaAutocomplete == 'inline' || ariaAutocomplete == 'both') {
						if (scope.textInput + scope.textInputSuffix != element.val()) {
							element.val(scope.textInput + scope.textInputSuffix);
						}
						element[0].setSelectionRange(scope.textInput.length, scope.textInput.length + scope.textInputSuffix.length);
					} else {
						if (scope.textInput != element.val())
							element.val(scope.textInput);
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
			},
			isTab: function(event) {
				return event.keyCode == 9;
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

		$scope.setSelectionSuggestionIndex = function(index) {
			$scope.selectedSuggestionIndex = index;
			$scope.selectedSuggestion = $scope.suggestions[index];

			calculateTextInputSuffix();
		}

		$scope.moveSelectionSuggestionIndex = function(delta) {
			if (!$scope.showSuggestions) {
				if ($scope.suggestions.length > 0) {
					$scope.showSuggestions = true;
				}

				return;
			}

			var newIndex = loopIndex($scope.selectedSuggestionIndex + delta, $scope.suggestions.length);

			$scope.setSelectionSuggestionIndex(newIndex);
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

			if (suggestions.length > 0)
				console.log('Replacing suggestions - showing suggestions');
		}

		$scope.selectSuggestion = function(suggestion) {
			$scope.selectedSuggestion = suggestion;
			$scope.selectedSuggestionIndex = $scope.suggestions.indexOf(suggestion);
			$scope.showSuggestions = false;
			$scope.textInput = $scope.formatSuggestion(suggestion);
			$scope.textInputSuffix = '';
		}

		$scope.isInlineCompletionEnabled = function() {
			return ariaAutocomplete == 'inline' || ariaAutocomplete == 'both';
		}

		$scope.textChanged = function(newText) {
			if ($scope.selectedSuggestion && newText == $scope.formatSuggestion($scope.selectedSuggestion))

			if ($scope.selectedSuggestion && $scope.isInlineCompletionEnabled && newText == $scope.textInput + $scope.textInputSuffix)
				return;

			if (newText == $scope.textInput)
				return;

			$scope.textInput = newText;
			calculateTextInputSuffix();

			var normalizedInput = newText||'';

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

					if ($scope.suggestions.length == 0) {
						$scope.setSelectionSuggestionIndex(-1);
					} else {
						var newIndex = $scope.suggestions.indexOf($scope.selectedSuggestion);

						if (newIndex == -1)
							newIndex = 0;

						$scope.setSelectionSuggestionIndex(newIndex);
					}

				}, function(err) {
					$scope.isLoadingSuggestions = false;
					if (err === 'cancelled')
						return;

					// TODO: Handle errors
				});
		};

		$scope.formatSuggestion = function(suggestion) {
			return (suggestion||{}).toString();
		}

		$scope.$watch('selectedSuggestion', function(newValue) {
			calculateTextInputSuffix(newValue);
		});

		function calculateTextInputSuffix() {
			if ($scope.selectedSuggestionIndex == -1) {
				$scope.textInputSuffix = '';
				return;
			}

			var formattedSuggestion = $scope.formatSuggestion($scope.selectedSuggestion);

			if (formattedSuggestion.indexOf($scope.textInput) == 0) {
				$scope.textInputSuffix = formattedSuggestion.substr($scope.textInput.length);
			}
		}

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