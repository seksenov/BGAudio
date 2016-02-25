(function () {
    "use strict";
    importScripts("ms-appx:///WinJS/js/base.js", "ms-appx:///js/messages.js");
    var BackgroundMediaPlayer = Windows.Media.Playback.BackgroundMediaPlayer;
    var MediaPlayerState = Windows.Media.Playback.MediaPlayerState;
    var MediaPlaybackType = Windows.Media.MediaPlaybackType;

    var ForegroundAppStatus = {
        active: 0,
        suspended: 1,
        unknown: 2
    };

    var SongChangedEvent = WinJS.Class.mix(WinJS.Class.define(function(){}), WinJS.Utilities.eventMixin);

    var MyPlaylist = WinJS.Class.define(
        function () {
            this.mediaPlayer.addEventListener("mediaopened", this.mediaPlayer_mediaOpened.bind(this));
            this.mediaPlayer.addEventListener("mediaended", this.mediaPlayer_mediaEnded.bind(this));
        },
        {
            currentSongId: 0,

            songChanged: new SongChangedEvent(),

            mediaPlayer: BackgroundMediaPlayer.current,

            mediaPlayer_mediaOpened: function (ev) {
                this.mediaPlayer.play();
                var songChangedEventDetails = new Object();
                songChangedEventDetails.songName = this.getCurrentSongName();
                this.songChanged.dispatchEvent("songchanged", songChangedEventDetails);
            },

            startSongAt: function(id) {
                if (this.currentSongId == id && this.mediaPlayer.currentState != MediaPlayerState.closed) {
                    this.mediaPlayer.play();
                } else {
                    var source = "ms-appx:///Media/Assets/" + MyPlaylist.songs[id];
                    this.currentSongId = id;
                    this.mediaPlayer.autoPlay = false;
                    this.mediaPlayer.setUriSource(new Windows.Foundation.Uri(source));
                }
            },

            mediaPlayer_mediaEnded: function(ev) {
                this.skipToNext();
            },

            playAllSongs: function () {
                this.startSongAt(0);
            },

            skipToNext: function() {
                this.startSongAt((this.currentSongId + 1) % MyPlaylist.songs.length);
            },
            
            getCurrentSongName: function () {
                if (this.currentSongId < MyPlaylist.songs.length) {
                    var fullUrl = MyPlaylist.songs[this.currentSongId];
                    var index = fullUrl.split("/").length;
                    return fullUrl.split("/")[index - 1];
                } else {
                    throw "Song Id Is higher than total number of songs";
                }
            }
        },
        {
            songs: [
                "Fragile.mp3",
                "k.m4a",
                "Perfect.m4a"
            ]
        }
    );

    var MyPlaylistManager = WinJS.Class.define(
        function () {

        },
        {
            getCurrent: function () {
                return MyPlaylistManager.instance;
            }
        },
        {
            instance: new MyPlaylist()
        }
    );


    var MyBackgroundAudioTask = WinJS.Class.define(
        function () {
            
        },
        {
            playlistManager: new MyPlaylistManager(),
            deferral: null,
            foregroundAppState: null,
            taskInstance: Windows.UI.WebUI.WebUIBackgroundTaskInstance.current,

            getPlaylist: function () {
                return this.playlistManager.getCurrent();
            },

            run: function () {
                this.taskInstance.addEventListener("canceled", this.onCanceled.bind(this));
                this.taskInstance.task.addEventListener("completed", this.taskCompleted.bind(this));

                this.foregroundAppState = ForegroundAppStatus.active;
                BackgroundMediaPlayer.addEventListener("messagereceivedfromforeground", this.backgroundMediaPlayer_messageReceivedFromForeground.bind(this));
                var message = new Windows.Foundation.Collections.ValueSet();
                message.insert(Messages.ServerStarted, "");
                BackgroundMediaPlayer.sendMessageToForeground(message);
                this.getPlaylist().songChanged.addEventListener("songchanged", this.playlist_songChanged.bind(this));
                this.deferral = this.taskInstance.getDeferral();
            },

            startPlayback: function () {
                this.getPlaylist().playAllSongs();
            },

            playlist_songChanged: function(ev) {
                var message = new Windows.Foundation.Collections.ValueSet();
                message.insert(Messages.currentSong, this.getPlaylist().getCurrentSongName());
                message.insert(Messages.myMusicIsPlaying, "");
                if (this.foregroundAppState == ForegroundAppStatus.active)
                {
                    BackgroundMediaPlayer.sendMessageToForeground(message);
                }
            },

            backgroundMediaPlayer_messageReceivedFromForeground: function (ev) {
                var iter = ev.data.first();
                while (iter.hasCurrent) {
                    switch(iter.current.key.toLowerCase()) {
                        case Messages.AppSuspended:
                            this.foregroundAppState = ForegroundAppStatus.suspended;
                            break;
                        case Messages.AppResumed:
                            this.foregroundAppState = ForegroundAppStatus.active;
                            var message = new Windows.Foundation.Collections.ValueSet();
                            message.insert(Constants.myMusicIsPlaying, "Yes");
                            BackgroundMediaPlayer.sendMessageToForeground(message);
                            break;
                        case Messages.StartPlayback:
                            console.log("Starting playback");
                            this.startPlayback();
                            break;
                        case Messages.SkipSong:
                            console.log("Skipping song");
                            this.skipSong();
                    }
                    iter.moveNext();
                }
            },

            skipSong: function() {
                this.getPlaylist().skipToNext();
            },

            taskCompleted: function (ev) {
                console.log("MyBackgroundAudioTaskJS Completed...");
                BackgroundMediaPlayer.shutdown();
                if (this.deferral) {
                    this.deferral.complete();
                }
            },

            onCanceled: function (ev) {
                console.log("MyBackgroundAudioTaskJS cancel requested...");
                BackgroundMediaPlayer.shutdown();
                if (this.deferral) {
                    this.deferral.complete();
                }
            }
        }
    );
    
    var task = new MyBackgroundAudioTask();
    task.run();

})();