"use strict";

(function(angular) {
  angular.module("youtubePluginContent").controller("ContentHomeCtrl", [
    "$scope",
    "Buildfire",
    "DataStore",
    "TAG_NAMES",
    "STATUS_CODE",
    "CONTENT_TYPE",
    "$modal",
    "$http",
    "YOUTUBE_KEYS",
    "Utils",
    "$timeout",
    "LAYOUTS",
    "$rootScope",
    "PROXY_SERVER",
    function(
      $scope,
      Buildfire,
      DataStore,
      TAG_NAMES,
      STATUS_CODE,
      CONTENT_TYPE,
      $modal,
      $http,
      YOUTUBE_KEYS,
      Utils,
      $timeout,
      LAYOUTS,
      $rootScope,
      PROXY_SERVER
    ) {
      var _data = {
        content: {
          carouselImages: [],
          description: "",
          rssUrl: TAG_NAMES.DEFAULT_FEED_URL,
          type: "",
          playListID: null,
          videoID: null,
          pluginInstance: null,
        },
        design: {
          itemListLayout: LAYOUTS.listLayouts[0].name,
          itemListBgImage: "",
          itemDetailsBgImage: ""
        },
        default: true
      };
      var ContentHome = this;
      ContentHome.masterData = angular.copy(_data);
      ContentHome.CONTENT_TYPE = CONTENT_TYPE;
      //ContentHome.data = angular.copy(_data);
      ContentHome.validLinkSuccess = false;
      ContentHome.validLinkFailure = false;
      ContentHome.contentType = CONTENT_TYPE.PLAYLIST_FEED;
      ContentHome.pluginInstanceName = '';
      ContentHome.failureMessage = "Error. Please check and try again";
      ContentHome.descriptionWYSIWYGOptions = {
        plugins: "advlist autolink link image lists charmap print preview",
        skin: "lightgray",
        trusted: true,
        theme: "modern"
      };

      // create a new instance of the buildfire carousel editor
      var editor = new Buildfire.components.carousel.editor("#carousel");

      // this method will be called when a new item added to the list
      editor.onAddItems = function(items) {
        if (!ContentHome.data.content.carouselImages)
          ContentHome.data.content.carouselImages = [];
        ContentHome.data.content.carouselImages.push.apply(
          ContentHome.data.content.carouselImages,
          items
        );
        $scope.$digest();
      };
      // this method will be called when an item deleted from the list
      editor.onDeleteItem = function(item, index) {
        ContentHome.data.content.carouselImages.splice(index, 1);
        $scope.$digest();
      };
      // this method will be called when you edit item details
      editor.onItemChange = function(item, index) {
        ContentHome.data.content.carouselImages.splice(index, 1, item);
        $scope.$digest();
      };
      // this method will be called when you change the order of items
      editor.onOrderChange = function(item, oldIndex, newIndex) {
        var items = ContentHome.data.content.carouselImages;

        var tmp = items[oldIndex];

        if (oldIndex < newIndex) {
          for (var i = oldIndex + 1; i <= newIndex; i++) {
            items[i - 1] = items[i];
          }
        } else {
          for (var i = oldIndex - 1; i >= newIndex; i--) {
            items[i + 1] = items[i];
          }
        }
        items[newIndex] = tmp;

        ContentHome.data.content.carouselImages = items;
        $scope.$digest();
      };

      updateMasterItem(_data);

      function updateMasterItem(data) {
        ContentHome.masterData = angular.copy(data);
      }

      function resetItem() {
        ContentHome.data = angular.copy(ContentHome.masterData);
      }

      function isUnchanged(data) {
        return angular.equals(data, ContentHome.masterData);
      }

      /*
       * Go pull any previously saved data
       * */
      var init = function() {
        var success = function(result) {
            console.info("init success result:", result);
            if (Object.keys(result.data).length > 0) {
              ContentHome.data = result.data;
            }
            if (result && !result.id) {
              ContentHome.data = angular.copy(_data);
              ContentHome.rssLink = ContentHome.data.content.rssUrl;
            } else {
              if (!ContentHome.data.content) ContentHome.data.content = {};
              if (ContentHome.data.content.type)
                ContentHome.contentType = ContentHome.data.content.type;
              if (ContentHome.data.content.rssUrl)
                ContentHome.rssLink = ContentHome.data.content.rssUrl;
              if (ContentHome.data.content.pluginInstance) {
                var pluginInstance = ContentHome.data.content.pluginInstance;
                ContentHome.pluginInstanceName = pluginInstance.pluginTypeName + ": " + pluginInstance.title;
              }
              if (!ContentHome.data.content.carouselImages)
                editor.loadItems([]);
              else editor.loadItems(ContentHome.data.content.carouselImages);
            }
            updateMasterItem(ContentHome.data);
            if (tmrDelay) clearTimeout(tmrDelay);
          },
          error = function(err) {
            if (err && err.code !== STATUS_CODE.NOT_FOUND) {
              console.error("Error while getting data", err);
              if (tmrDelay) clearTimeout(tmrDelay);
            } else if (err && err.code === STATUS_CODE.NOT_FOUND) {
              saveData(
                JSON.parse(angular.toJson(ContentHome.data)),
                TAG_NAMES.YOUTUBE_INFO
              );
            }
          };
        DataStore.get(TAG_NAMES.YOUTUBE_INFO).then(success, error);
      };
      init();

      /*
       * Call the datastore to save the data object
       */
      var saveData = function(newObj, tag) {
        if (typeof newObj === "undefined") {
          return;
        }
        var success = function(result) {
            console.info("Saved data result: ", result);
            updateMasterItem(newObj);
          },
          error = function(err) {
            console.error("Error while saving data : ", err);
          };
        DataStore.save(newObj, tag).then(success, error);
      };

      /*
       * create an artificial delay so api isnt called on every character entered
       * */
      var tmrDelay = null;
      var saveDataWithDelay = function(newObj) {
        if (newObj) {
          if (isUnchanged(newObj)) {
            return;
          }
          if (tmrDelay) {
            clearTimeout(tmrDelay);
          }
          tmrDelay = setTimeout(function() {
            if (newObj && newObj.default) {
              if (newObj.content.rssUrl == TAG_NAMES.DEFAULT_FEED_URL) {
                newObj.content.rssUrl = "";
                ContentHome.data.content.rssUrl = "";
                ContentHome.rssLink = ContentHome.data.content.rssUrl;
              }
              delete newObj.default;
            }
            saveData(
              JSON.parse(angular.toJson(newObj)),
              TAG_NAMES.YOUTUBE_INFO
            );
          }, 500);
        }
      };
      /*
       * watch for changes in data and trigger the saveDataWithDelay function on change
       * */
      $scope.$watch(
        function() {
          return ContentHome.data;
        },
        saveDataWithDelay,
        true
      );

      // Function to validate youtube rss feed link entered by user.

      ContentHome.validateRssLink = function() {
        let apiKey = buildfire.getContext().apiKeys.googleApiKey;
      
          var playlistId = Utils.extractPlaylistId(ContentHome.rssLink);
          if (playlistId) {
            $http
              .post(PROXY_SERVER.serverUrl + "/videos", {
                playlistId: playlistId,
                countLimit: 1,
                apiKey: apiKey
              })
              .success(function(response) {
                ContentHome.failureMessage =
                  "Error. Please check and try again";
                  
                if (response && response.videos && response.videos.items) {
                  ContentHome.validLinkSuccess = true;
                  $timeout(function() {
                    ContentHome.validLinkSuccess = false;
                  }, 5000);
                  ContentHome.validLinkFailure = false;
                  ContentHome.data.content.rssUrl = ContentHome.rssLink;
                  ContentHome.data.content.type = ContentHome.contentType;
                  if (response)
                    ContentHome.data.content.playListID = playlistId;
                  ContentHome.data.content.videoID = null;
                  searchEngine.indexFeed(playlistId);
                } else {
                  console.log('Something went wrong with URL', response);
                  ContentHome.validLinkFailure = true;
                  $timeout(function() {
                    ContentHome.validLinkFailure = false;
                  }, 5000);
                  ContentHome.validLinkSuccess = false;
                }
              })
              .error(function(err) {
                console.error('Error ', err);
                ContentHome.failureMessage =
                  "Error. Please check and try again";
                ContentHome.validLinkFailure = true;
                $timeout(function() {
                  ContentHome.validLinkFailure = false;
                }, 5000);
                ContentHome.validLinkSuccess = false;
              });
          } else {
            if (Utils.extractSingleVideoId(ContentHome.rssLink)) {
              ContentHome.failureMessage =
                "Seems like you have entered single video url. Please choose correct option to validate url.";
            }
            ContentHome.validLinkFailure = true;
            $timeout(function() {
              ContentHome.validLinkFailure = false;
              ContentHome.failureMessage =
                "Error. Please check and try again";
            }, 5000);
            ContentHome.validLinkSuccess = false;
          }
      };

      $scope.onSelectFeature = function() {
        Buildfire.pluginInstance.showDialog({}, (error, instances) => {
          if (instances && instances.length > 0) {
            ContentHome.pluginInstanceName = instances[0].pluginTypeName + ": " + instances[0].title;
            ContentHome.data.content.pluginInstance = instances[0];
            $scope.$digest();
          } 
        });
      };

      ContentHome.clearData = function() {
        if (!ContentHome.rssLink) {
          ContentHome.contentType = ContentHome.CONTENT_TYPE.PLAYLIST_FEED;
          ContentHome.data.content.rssUrl = null;
          ContentHome.data.content.type = ContentHome.contentType;
          ContentHome.data.content.videoID = null;
          ContentHome.data.content.playListID = null;
        }
      };
    }
  ]);
})(window.angular);
