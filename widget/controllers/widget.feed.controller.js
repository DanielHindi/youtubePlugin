"use strict";

(function (angular, buildfire) {
  angular.module("youtubePluginWidget").controller("WidgetFeedCtrl", [
    "$scope",
    "Buildfire",
    "DataStore",
    "TAG_NAMES",
    "STATUS_CODE",
    "YoutubeApi",
    "VIDEO_COUNT",
    "$sce",
    "Location",
    "$rootScope",
    "LAYOUTS",
    "VideoCache",
    function (
      $scope,
      Buildfire,
      DataStore,
      TAG_NAMES,
      STATUS_CODE,
      YoutubeApi,
      VIDEO_COUNT,
      $sce,
      Location,
      $rootScope,
      LAYOUTS,
      VideoCache
    ) {
      var WidgetFeed = this;

      WidgetFeed.data = {};
      //create new instance of buildfire carousel viewer
      var view = null;
      WidgetFeed.videos = [];
      WidgetFeed.busy = false;
      WidgetFeed.nextPageToken = null;
      WidgetFeed.totalResults = 0;
      $rootScope.showFeed = true;
      var currentListLayout = null;
      var currentPlayListId = null;
      WidgetFeed.masterData = {
        playListId: ""
      };
      WidgetFeed.pluginName = "YouTube";

      /*declare the device width heights*/
      $rootScope.deviceHeight = window.innerHeight;
      $rootScope.deviceWidth = window.innerWidth || 320;
      WidgetFeed.appHeight = window.innerWidth * (9 / 16);

      // var handleBookmarkNav = function (videos) {
      //   buildfire.deeplink.getData(function(data) {
      //     if (data && data.link) {
      //       var video = videos.filter(function(video) {
      //         return video.snippet.resourceId.videoId === data.link;
      //       })[0];
      //       WidgetFeed.navigateTo(video);
      //     }
      //   });
      // };

      /*
       * Fetch user's data from datastore
       */
      var initData = function (isRefresh) {
        var success = function (result) {
            cache.getCache(function (err, data) {
              // if the rss feed url has changed, ignore the cache and update when fetched
              if (err || !data || data.rssUrl != result.data.content.rssUrl)
                return;
              getFeedVideosSuccess(data, true);
            });

            WidgetFeed.data = result.data;
            if (!WidgetFeed.data.design) WidgetFeed.data.design = {};
            if (!WidgetFeed.data.content) WidgetFeed.data.content = {};
            if (!WidgetFeed.data.design.itemListLayout) {
              WidgetFeed.data.design.itemListLayout =
                LAYOUTS.listLayouts[0].name;
            }
            if (WidgetFeed.data.design.itemListBgImage) {
              $rootScope.backgroundListImage =
                WidgetFeed.data.design.itemListBgImage;
            }
            if (!result.id) {
              WidgetFeed.data.content.playListID = TAG_NAMES.DEFAULT_FEED_ID;
            }
            if (WidgetFeed.data.content.type)
              $rootScope.contentType = WidgetFeed.data.content.type;
            currentListLayout = WidgetFeed.data.design.itemListLayout;
            if (WidgetFeed.data.content && WidgetFeed.data.content.playListID) {
              currentPlayListId = WidgetFeed.data.content.playListID;
              WidgetFeed.masterData.playListId = currentPlayListId;
            }
            if (WidgetFeed.data.content && WidgetFeed.data.content.videoID) {
              Location.goTo("#/video/" + WidgetFeed.data.content.videoID);
            }
            if (!$scope.$$phase) $scope.$digest();
            if (isRefresh) {
              if (
                currentListLayout != WidgetFeed.data.design.itemListLayout &&
                view &&
                WidgetFeed.data.content.carouselImages
              ) {
                if (WidgetFeed.data.content.carouselImages.length)
                  view._destroySlider();
                view = null;
              } else {
                if (view) {
                  view.loadItems(WidgetFeed.data.content.carouselImages);
                }
              }
              WidgetFeed.loadMore();
            }
            // bookmarks.findAndMarkAll($scope);
            viewedVideos.findAndMarkViewed(WidgetFeed.videos);
          },
          error = function (err) {
            if (err && err.code !== STATUS_CODE.NOT_FOUND) {
              console.error("Error while getting data", err);
            }
          };
        DataStore.get(TAG_NAMES.YOUTUBE_INFO).then(success, error);
      };

      var init = function (isRefresh) {
        buildfire.getContext(function (err, result) {
          if (err) console.error(err);
          window.bfInstanceId = result.instanceId;
          WidgetFeed.pluginName = (result && result.title) || "YouTube";
        });

        viewedVideos.init();
        initData(isRefresh);
        rememberScrollPosition('scrollDiv');
      };


      var debounce = function (func, wait) {
        let timeout;
        return function () {
          let context = this,
            args = arguments;
          let later = function () {
            timeout = null;
            func.apply(context, args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
      };

      var rememberScrollPosition = function (id) {
        let element = document.getElementById(id);
        if (!element) return console.warn(`Element with id "${id}" not found`);
        element.addEventListener("scroll", debounce(() => {
          buildfire.localStorage.setItem("scrollTop", element.scrollTop);
        }, 500));
      };

      var restoreScrollPosition = function (id) {
        console.log('restoreScrollPosition');
        let element = document.getElementById(id);
        if (!element) return console.warn(`Element with id "${id}" not found`);
        buildfire.localStorage.getItem("scrollTop", (err, scrollTop) => {
          // element.scrollTop = scrollTop || 0;
          element.scroll({
            top: scrollTop || 0,
            behavior: 'smooth'
          });
        });
      };

      var handleBookmarkNav = function (videos) {
        buildfire.deeplink.getData(function (data) {
          if (data && data.link) {
            var linkD = data.link;
            if (linkD.indexOf("yt:video") > -1) {
              linkD = linkD.slice(linkD.lastIndexOf(":") + 1, linkD.length);
            }
            var video = videos.filter(function (video) {
              return video.snippet.resourceId.videoId === linkD;
            })[0];
            if (data.timeIndex) video.seekTo = data.timeIndex;
            
            var backNavigation = buildfire.navigation.getBackNavigationInstanceId();
            if (linkD && !backNavigation) {
              WidgetFeed.navigateTo(video);
            }
          }
        });
      };

      init();

      $rootScope.$on("Carousel:LOADED", function () {
        WidgetFeed.view = null;
        if (!WidgetFeed.view) {
          var carouselSlides = WidgetFeed.data.content.carouselImages || [];
          var carouselSelector = document.getElementById("carousel");
          WidgetFeed.view = new Buildfire.components.carousel.view({
            selector: carouselSelector,
            items: carouselSlides
          });
          var css =
            "min-height: " +
            window.innerWidth * 0.5625 +
            "px !important;position: relative;top: 0px;left: 0px; display: block;";
          setTimeout(function () {
            document.getElementById("carousel").setAttribute("style", css);
          }, 50);
        }
        if (WidgetFeed.data.content && WidgetFeed.data.content.carouselImages) {
          WidgetFeed.view._loadImages(
            WidgetFeed.data.content.carouselImages,
            () => console.log("WidgetFeed Load Images")
          );
        } else {
          WidgetFeed.view._loadImages([], () =>
            console.log("WidgetFeed Load Images []")
          );
        }
      });

      var getFeedVideosSuccess = function (result, isCachedData) {
        // compare the first item of the cached feed and the fetched feed
        // return if the feed hasnt changed
        Buildfire.spinner.hide();
        var isUnchanged = WidgetFeed.videos[0] && WidgetFeed.videos[0].id === result.items[0].id;
        if (isUnchanged) {
          if (!$scope.$$phase) $scope.$digest();
          return;
        };

        bookmarks.findAndMarkAll($scope);
        viewedVideos.findAndMarkViewed(result.items);
        WidgetFeed.totalResults = result.pageInfo.totalResults;
        WidgetFeed.videos = WidgetFeed.videos.length ?
          WidgetFeed.videos.concat(result.items) :
          result.items;
        handleBookmarkNav(WidgetFeed.videos);

        // attach the feed url for diff checking later
        // save or update the cache

        if (isCachedData) {
          getFeedVideos(currentPlayListId).then((newResult) => {
            Buildfire.spinner.hide();
            newResult.rssUrl = WidgetFeed.data.content.rssUrl ? WidgetFeed.data.content.rssUrl : false;
            cache.saveCache(newResult);
          }, getFeedVideosError);

        } else {
          cache.getCache(function (err, data) {
            if (err || !data || data.rssUrl !== WidgetFeed.data.content.rssUrl) {
              result.rssUrl = WidgetFeed.data.content.rssUrl ? WidgetFeed.data.content.rssUrl : false;
              cache.saveCache(result);
            }
          });
        };

        WidgetFeed.nextPageToken = result.nextPageToken;
        if (WidgetFeed.videos.length < result.pageInfo.totalResults) {
          WidgetFeed.busy = false;
        }
        if (!$scope.$$phase) $scope.$digest();
        setTimeout(function () {
          restoreScrollPosition('scrollDiv');
        }, 1);
      };

      var getFeedVideosError = function (err) {
        Buildfire.spinner.hide();
        console.error("Error In Fetching feed Videos", err);
      };

      var getFeedVideos = function (_playlistId) {
        let apiKey = buildfire.getContext().apiKeys.googleApiKey;

        Buildfire.spinner.show();
        return YoutubeApi.getFeedVideos(
          _playlistId,
          VIDEO_COUNT.LIMIT,
          WidgetFeed.nextPageToken,
          apiKey
        );
      };

      var onUpdateCallback = function (event) {
        if (event && event.tag === TAG_NAMES.YOUTUBE_INFO) {
          WidgetFeed.data = event.data;
          if (!WidgetFeed.data.design) WidgetFeed.data.design = {};
          if (!WidgetFeed.data.content) WidgetFeed.data.content = {};
          if (WidgetFeed.data.content.type)
            $rootScope.contentType = WidgetFeed.data.content.type;
          if (!WidgetFeed.data.design.itemListLayout) {
            WidgetFeed.data.design.itemListLayout = LAYOUTS.listLayouts[0].name;
          }
          if (WidgetFeed.data.design.itemListBgImage) {
            $rootScope.backgroundListImage =
              WidgetFeed.data.design.itemListBgImage;
          } else {
            $rootScope.backgroundListImage = "";
          }

          if (
            currentListLayout != WidgetFeed.data.design.itemListLayout &&
            view &&
            WidgetFeed.data.content.carouselImages
          ) {
            if (WidgetFeed.data.content.carouselImages.length)
              view._destroySlider();
            view = null;
          } else {
            if (view) {
              view.loadItems(WidgetFeed.data.content.carouselImages);
            }
          }
          currentListLayout = WidgetFeed.data.design.itemListLayout;
          currentPlayListId = WidgetFeed.data.content.playListID;

          if (!WidgetFeed.data.content.rssUrl) {
            WidgetFeed.videos = [];
            WidgetFeed.busy = false;
            WidgetFeed.nextPageToken = null;
          } else if (
            !(WidgetFeed.videos.length > 0) &&
            WidgetFeed.data.content.playListID
          ) {
            currentPlayListId = WidgetFeed.data.content.playListID;
            getFeedVideos(WidgetFeed.data.content.playListID).then(getFeedVideosSuccess, getFeedVideosError);
          }

          if (
            WidgetFeed.data.content &&
            WidgetFeed.data.content.playListID &&
            WidgetFeed.data.content.playListID !==
            WidgetFeed.masterData.playListId
          ) {
            currentPlayListId = WidgetFeed.data.content.playListID;
            WidgetFeed.masterData.playListId = currentPlayListId;
            WidgetFeed.videos = [];
            WidgetFeed.busy = false;
            WidgetFeed.nextPageToken = null;
            WidgetFeed.loadMore();
          } else if (WidgetFeed.data.content && WidgetFeed.data.content.videoID) {
            // Location.goTo("#/video/" + WidgetFeed.data.content.videoID);
          }
        }
      };
      DataStore.onUpdate().then(null, null, onUpdateCallback);

      WidgetFeed.loadMore = function () {
        if (WidgetFeed.busy) return;
        WidgetFeed.busy = true;
        if (currentPlayListId && currentPlayListId !== "1") {
          getFeedVideos(currentPlayListId).then(getFeedVideosSuccess, getFeedVideosError);
        };
        // else {
        //   if (WidgetFeed.data.content.videoID)
        //     Location.goTo("#/video/" + WidgetFeed.data.content.videoID);
        // }
      };

      WidgetFeed.safeHtml = function (html) {
        if (html) {
          var $html = $("<div />", {
            html: html
          });
          $html.find("iframe").each(function (index, element) {
            var src = element.src;
            src =
              src && src.indexOf("file://") != -1 ?
              src.replace("file://", "http://") :
              src;
            element.src =
              src && src.indexOf("http") != -1 ? src : "http:" + src;
          });
          return $sce.trustAsHtml($html.html());
        }
      };

      WidgetFeed.showDescription = function (description) {
        var _retVal = false;
        if (description) {
          description = description.trim();
          if (
            description !== "<p>&nbsp;<br></p>" &&
            description !== '<p><br data-mce-bogus="1"></p>'
          ) {
            _retVal = true;
          }
        }
        return _retVal;
      };

      WidgetFeed.view = function (video) {
        viewedVideos.markViewed($scope, video);
      };

      WidgetFeed.openDetailsPage = function (video) {
        setTimeout(function () {
          viewedVideos.markViewed($scope, video);
        }, 2000);
        video.id = video.snippet.resourceId.videoId;
        VideoCache.setCache(video);
        buildfire.history.push(WidgetFeed.pluginName, {
          showLabelInTitlebar: true
        });
        Location.goTo("#/video/" + video.snippet.resourceId.videoId);
      };


      WidgetFeed.navigateTo = function (video) {
        var pluginData = WidgetFeed.data.content.pluginInstance;
        if (!pluginData) {
          return;
        }
        viewedVideos.markViewed($scope, video);
        var videoId = video.snippet.resourceId.videoId;
        var queryString = `?vidId=${videoId}`;
        pluginData.queryString = queryString;
        Buildfire.navigation.navigateTo(pluginData);
      };


      WidgetFeed.getThumbnail = function (video) {
        var isTablet = $rootScope.deviceWidth >= 768;
        if (isTablet && video.snippet.thumbnails.maxres) {
          return video.snippet.thumbnails.maxres.url;
        } else {
          return video.snippet.thumbnails.medium.url;
        }
      };

      WidgetFeed.bookmark = function ($event, video) {
        $event.stopImmediatePropagation();
        var isBookmarked = video.bookmarked ? true : false;
        if (isBookmarked) {
          bookmarks.delete($scope, video);
        } else {
          bookmarks.add($scope, video);
        }
      };

      WidgetFeed.share = function ($event, video) {
        $event.stopImmediatePropagation();
        // TODO add video meta  tags
        let link = {};
        link.title = video.snippet.title;
        link.type = "website";
        link.description = video.snippet.description;
        link.imageUrl = WidgetFeed.getThumbnail(video);

        link.data = {
          "link": video.snippet.resourceId.videoId
        };

        buildfire.deeplink.generateUrl(link, function (err, result) {
          if (err) {
            console.error(err);
          } else {
            var options = {
              // subject: video.snippet.title,
              // text: video.snippet.description,
              // image: video.snippet.thumbnails.default.url,
              link: result.url
            };
            var callback = function (err, result) {
              if (err) {
                console.warn(err);
              };
            };

            buildfire.device.share(options, callback);
          };
        });

      };

      WidgetFeed.updateAuthListeners = function () {
        buildfire.auth.onLogin(function (user) {
          init(true);
        });

        buildfire.auth.onLogout(function (err) {
          console.log(err);
          init(true);
        });
      };

      $rootScope.$on("ROUTE_CHANGED", function (e, data) {
        WidgetFeed.data = data;

        WidgetFeed.updateAuthListeners();

        if (WidgetFeed.data && !WidgetFeed.data.design) {
          WidgetFeed.data.design = {};
        }

        if (WidgetFeed.data && !WidgetFeed.data.content) {
          WidgetFeed.data.content = {};
        }

        if (
          WidgetFeed.data &&
          WidgetFeed.data.content.playListID &&
          WidgetFeed.masterData.playListId != WidgetFeed.data.content.playListID
        ) {
          WidgetFeed.busy = false;
          WidgetFeed.nextPageToken = null;
          WidgetFeed.videos = [];
          WidgetFeed.masterData.playListId = WidgetFeed.data.content.playListID;
          getFeedVideos(WidgetFeed.data.content.playListID.then(getFeedVideosSuccess, getFeedVideosError));
        }

        if (WidgetFeed.data.design && WidgetFeed.data.design.itemListBgImage) {
          $rootScope.backgroundListImage =
            WidgetFeed.data.design.itemListBgImage;
        } else {
          $rootScope.backgroundListImage = "";
        }

        if (
          !(WidgetFeed.videos.length >= 0) &&
          WidgetFeed.data.content.playlistId
        ) {
          currentPlayListId = WidgetFeed.data.content.playListID;
          WidgetFeed.masterData.playListId = currentPlayListId;
          getFeedVideos(WidgetFeed.data.content.playListID).then(getFeedVideosSuccess, getFeedVideosError);
        } else {
          bookmarks.findAndMarkAll($scope);
        }

        if (
          currentListLayout != WidgetFeed.data.design.itemListLayout &&
          view &&
          WidgetFeed.data.content.carouselImages
        ) {
          if (WidgetFeed.data.content.carouselImages.length) {
            view._destroySlider();
            view = null;
          }
        } else {
          if (view) {
            view.loadItems(WidgetFeed.data.content.carouselImages);
          }
        }

        currentListLayout = WidgetFeed.data.design.itemListLayout;

        DataStore.onUpdate().then(null, null, onUpdateCallback);

        buildfire.datastore.onRefresh(function () {
          WidgetFeed.videos = [];
          WidgetFeed.busy = false;
          WidgetFeed.nextPageToken = null;
          initData(true);
        });
      });

      buildfire.datastore.onRefresh(function () {
        WidgetFeed.videos = [];
        WidgetFeed.busy = false;
        WidgetFeed.nextPageToken = null;
        initData(true);
      });

      $scope.$on("$destroy", function () {
        DataStore.clearListener();
      });

      $scope.$on("$viewContentLoaded", function () {
        buildfire.appearance.ready();
      });

      WidgetFeed.updateAuthListeners();
    }
  ]);
})(window.angular, window.buildfire);