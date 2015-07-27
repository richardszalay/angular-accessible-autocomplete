(function() {
	'use strict';

	var accessibleAutocompleteProvider = [function () {
		var defaultOptions = {
			template: '<ul class="rs-autocomplete" role="listbox" aria-expanded="{{showSuggestions}}" ng-show="showSuggestions" id="{{suggestionsListId}}"> ' +
				'<li ng-repeat="suggestion in suggestions" ' +
				'    id="{{suggestionsListId + \'-\' + $index}}" ' +
				'    role="option" aria-selected="{{$index == selectedSuggestionIndex}}" ' +
				'    ng-bind="suggestion" ' +
				'    ng-click="selectSuggestion(suggestion)" ' +
				'></li>' +
				'</ul>',
			templateUrl: null,
			minimumLength: 3,
			delay: 100
		};

		this.setDefaultOptions = function(options) {
			angular.extend(defaultOptions, options);
		};

		var provider = this;

		this.$get = function() {
			return defaultOptions;
		};
	}];

	var accessibleAutocompleteDirective = ['$http', '$compile', '$templateCache', '$q', 'accessibleAutocomplete', 'accessibleAutocompleteKeyProcessor', '$timeout',
								  function ($http, $compile, $templateCache, $q, accessibleAutocomplete, accessibleAutocompleteKeyProcessor, $timeout) {

		var stripHttpData = function(resp) {
			return resp.data;
		};

		return {
			restrict: 'A',
			scope: {
				selectedHandler: '&accessibleAutocompleteSelected',
				suggestionsSelector: '&accessibleAutocomplete',
				templateUrl: '@accessibleAutocompleteTemplateUrl',
				minimumLength: '&accessibleAutocompleteMinimumLength'
			},
			link: function(scope, element, attrs) {

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

				var knownBlurTarget = false;

				element.on('focus', function() {
					knownBlurTarget = false
				});

				element.on('blur', function(event) {
					if (!knownBlurTarget) {
						scope.$evalAsync(function() {
							scope.showSuggestions = false;
						});
					}
				});

				element.on('keydown', function(event) {
					scope.$evalAsync(function() {
						if (accessibleAutocompleteKeyProcessor.isEscape(event)) {
							scope.hideSuggestions();
							scope.setSelectionSuggestionIndex(-1);
							event.preventDefault();
						} else if (accessibleAutocompleteKeyProcessor.isDown(event)) {
							scope.moveSelectionSuggestionIndex(1);
							event.preventDefault();
						} else if (accessibleAutocompleteKeyProcessor.isUp(event)) {
							scope.moveSelectionSuggestionIndex(-1);
							event.preventDefault();
						} else if (accessibleAutocompleteKeyProcessor.isTab(event)) {
							if (scope.showSuggestions && scope.selectedSuggestionIndex != -1) {
								scope.selectSuggestion(scope.selectedSuggestion);

								event.preventDefault();
							}
						} else if (accessibleAutocompleteKeyProcessor.isEnter(event)) {
							if (scope.showSuggestions) {
								scope.selectSuggestion(scope.selectedSuggestion);

								event.preventDefault();
							}
						}
					});
				});

				element.on('keyup input', function() {
					scope.$evalAsync(function() {
						if (element.val() != scope.textInput + scope.textInputSuffix)
							scope.textChanged(element.val());
					});
				});

				if (ariaAutocomplete == 'list' || ariaAutocomplete == 'both') {

					var templatePromise = scope.options.templateUrl ?
						$http.get(scope.options.templateUrl, {cache: $templateCache}).then(stripHttpData) :
						$q.when(scope.options.template);

					templatePromise.then(function(template) {
						scope.suggestionsListId = 'accessible-autocomplete-' + (new Date()).getTime();
						scope.suggestionsList = $compile(template)(scope);

						scope.suggestionsList.on('mousedown touchdown', function() {
							knownBlurTarget = true;
						});

						element.after(scope.suggestionsList);

						element.attr('aria-owns', scope.suggestionsListId);
					}, function(err) {
						// TODO: err
						throw err;
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

						if (element[0].setSelectionRange) {
							element[0].setSelectionRange(scope.textInput.length, scope.textInput.length + scope.textInputSuffix.length);
						}
					} else {
						if (scope.textInput != element.val())
							element.val(scope.textInput);
					}
				});
			},
			unlink: function(scope, element) {
				// TODO: Less conflict-prone 
				element.off('keydown');
				element.off('keyup');

				scope.suggestionsList.remove();
				scope.suggestionsList = null;
			},
			controller: accessibleAutocompleteController
		};
	}];

	var accessibleAutocompleteKeyProcessor = [function () {
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
	}];

	var accessibleAutocompleteController = ['$scope', 'accessibleSerialTimeout', 'accessibleSerialPromise', 'accessibleAutocomplete',
								   function ($scope, accessibleSerialTimeout, accessibleSerialPromise, accessibleAutocomplete) {
		$scope.options = angular.extend({}, accessibleAutocomplete);

		$scope.options.templateUrl = $scope.templateUrl || $scope.options.templateUrl;

		if (typeof $scope.minimumLength() !== 'undefined')
			$scope.options.minimumLength = $scope.minimumLength();

		$scope.textInput = '';
		$scope.textInputSuffix = '';

		$scope.suggestions = [];
		$scope.showSuggestions = false;
		$scope.selectedSuggestion = null;
		$scope.selectedSuggestionIndex = -1;

		// TODO: defaultOptions via provider 

		var serialTimeout = accessibleSerialTimeout();
		var serialPromise = accessibleSerialPromise();

		if (typeof $scope.suggestionsSelector != 'function')
			$scope.suggestionsSelector = function() { return []; };
		else
			$scope.suggestionsSelector = $scope.suggestionsSelector(); // TODO: ?

		$scope.hideSuggestions = function() {
			$scope.showSuggestions = false;
		};

		$scope.setSelectionSuggestionIndex = function(index, setSuffix) {
			$scope.selectedSuggestionIndex = index;
			$scope.selectedSuggestion = $scope.suggestions[index];

			if (setSuffix) {
				calculateTextInputSuffix();
			}
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
		}

		// TODO: Need to differentiate between 'committing' a selection and simply moving up/down
		$scope.selectSuggestion = function(suggestion) {
			$scope.selectedSuggestion = suggestion;
			$scope.selectedSuggestionIndex = $scope.suggestions.indexOf(suggestion);
			$scope.showSuggestions = false;
			$scope.textInputSuffix = '';

			var handler = $scope.selectedHandler();

			if ($scope.selectedSuggestionIndex != -1) {
				$scope.textInput = $scope.formatSuggestion(suggestion);
				if (typeof handler == 'function') {
					handler($scope.selectedSuggestion, $scope.selectedSuggestionIndex);
				}
			} else {
				handler($scope.textInput, -1);
			}
		}

		$scope.isInlineCompletionEnabled = function() {
			return ariaAutocomplete == 'inline' || ariaAutocomplete == 'both';
		}

		$scope.textChanged = function(newText) {
			if ($scope.selectedSuggestion && newText == $scope.formatSuggestion($scope.selectedSuggestion))
				return;

			if ($scope.selectedSuggestion && $scope.isInlineCompletionEnabled() && newText == $scope.textInput + $scope.textInputSuffix)
				return;

			if (newText == $scope.textInput)
				return;

			var isContinuation = ($scope.textInput.length && newText.indexOf($scope.textInput) == 0);

			$scope.textInput = newText;

			if (isContinuation) {
				calculateTextInputSuffix();
			} else {
				$scope.textInputSuffix = '';
			}

			var normalizedInput = newText||'';

			if ($scope.options.minimumLength && normalizedInput.length < $scope.options.minimumLength)
				return;

			serialTimeout(null, $scope.options.delay)
				.then(function() {
					$scope.isLoadingSuggestions = true;

					if (typeof $scope.suggestionsSelector == 'function')
						return $scope.suggestionsSelector(normalizedInput);

					return $scope.suggestionsSelector;
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

						$scope.setSelectionSuggestionIndex(newIndex, isContinuation);
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
	}];

	var accessibleSerialTimeout = ['$timeout', function accessibleSerialTimeout($timeout) {
		return function() {
			var currentTimeout = null;

			return function(callback, delay) {
				if (currentTimeout != null) {
					$timeout.cancel(currentTimeout);
				}

				return (currentTimeout = $timeout(function(){}, delay));
			}
		}
	}];

	var accessibleSerialPromise = ['$q', function accessibleSerialPromise($q) {
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
	}];

	angular.module('accessibleAutocomplete', [])
		.provider('accessibleAutocomplete', accessibleAutocompleteProvider)
		.factory('accessibleSerialTimeout', accessibleSerialTimeout)
		.factory('accessibleSerialPromise', accessibleSerialPromise)
		.service('accessibleAutocompleteKeyProcessor', accessibleAutocompleteKeyProcessor)
		.controller('accessibleAutocompleteController', accessibleAutocompleteController)
		.directive('accessibleAutocomplete', accessibleAutocompleteDirective);
})();