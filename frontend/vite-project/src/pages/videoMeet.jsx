import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { TextField, Button, IconButton, Badge } from "@mui/material";
import { io } from "socket.io-client";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import styles from "../styles/videoComponent.module.css";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";

const server_url = "http://localhost:8000";

var connections = {}

const peerConfigconnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
    ]
}

export default function VideoMeetComponent() {

    var socketRef = useRef();
    let socketIdRef = useRef();

    let localVideoRef = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);

    let [video, setVideo] = useState([]);
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModel, setShowModel] = useState(true);
    let [screenAvailable, setScreenAvailable] = useState();

    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState(0);
    let [prevMessages, setPrevMessages] = useState();


    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState("");

    let videoRef = useRef([]);
    let [videos, setVideos] = useState([]);

    // FIX: queue for ICE candidates that arrive before setRemoteDescription resolves
    let iceCandidatesQueueRef = useRef({});

    console.log("videos state:", videos);

    const getPermissions = async () => {
        try {
            const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
            setVideoAvailable(!!videoPermission);

            const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
            setAudioAvailable(!!audioPermission);

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            if (videoAvailable || audioAvailable) {
                const userMediaStream = await navigator.mediaDevices.getUserMedia({ video: videoAvailable, audio: audioAvailable });

                if (userMediaStream) {
                    window.localStream = userMediaStream;
                    if (localVideoRef.current) {
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                }
            }
        }
        catch (err) {
            console.log(err);
        }
    }

    useEffect(() => {
        getPermissions();
    }, []);

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator();

        let dst = oscillator.connect(ctx.createMediaStreamDestination());

        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
    }

    let black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), { width, height });

        canvas.getContext("2d").fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false })
    }

    let getUserMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream;
        localVideoRef.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue

            window.localStream.getTracks().forEach(track => {
                const sender = connections[id].getSenders().find(s => s.track && s.track.kind === track.kind);
                if (sender) {
                    sender.replaceTrack(track);
                } else {
                    connections[id].addTrack(track, window.localStream);
                }
            });

            const isNewConnection = connections[id].getSenders().length <= window.localStream.getTracks().length
                && !connections[id].currentLocalDescription;

            if (isNewConnection) {
                connections[id].createOffer().then((description) => {
                    connections[id].setLocalDescription(description)
                        .then(() => {
                            socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connections[id].localDescription }))
                        })
                        .catch(e => console.log(e))
                })
            }
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false)
            setAudio(false);

            try {
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;

            for (let id in connections) {
                window.localStream.getTracks().forEach(track => {
                    const sender = connections[id].getSenders().find(s => s.track && s.track.kind === track.kind);
                    if (sender) {
                        sender.replaceTrack(track);
                    }
                });
            }
        })
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
                .then(getUserMediaSuccess)
                .catch((e) => console.log(e))
        } else {
            try {
                let tracks = localVideoRef.current.srcObject.getTracks();
                tracks.forEach((track) => track.stop())
            } catch (e) { }
        }
    }

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
        }
    }, [video, audio])

    let getMessageFromServer = (fromId, message) => {
        let signal = JSON.parse(message);

        if (fromId !== socketIdRef.current) {

            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    .then(() => {
                        let queue = iceCandidatesQueueRef.current[fromId];
                        if (queue) {
                            queue.forEach(ice => {
                                connections[fromId].addIceCandidate(new RTCIceCandidate(ice)).catch(e => console.log(e));
                            });
                            iceCandidatesQueueRef.current[fromId] = [];
                        }

                        if (signal.sdp.type === "offer") {

                            if (window.localStream) {
                                const existingTracks = connections[fromId].getSenders().map(s => s.track);
                                window.localStream.getTracks().forEach(track => {
                                    if (!existingTracks.includes(track)) {
                                        try {
                                            connections[fromId].addTrack(track, window.localStream);
                                        } catch (e) {
                                            console.log("addTrack error:", e);
                                        }
                                    }
                                });
                            }

                            connections[fromId].createAnswer().then((description) => {
                                connections[fromId].setLocalDescription(description).then(() => {
                                    socketRef.current.emit("signal", fromId, JSON.stringify({ "sdp": connections[fromId].localDescription }))
                                }).catch(e => console.log(e))
                            }).catch(e => console.log(e))
                        }

                    }).catch(e => console.log("setRemoteDescription error:", e))
            }

            if (signal.ice) {
                if (connections[fromId].remoteDescription && connections[fromId].remoteDescription.type) {
                    connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e => console.log(e));
                } else {
                    if (!iceCandidatesQueueRef.current[fromId]) iceCandidatesQueueRef.current[fromId] = [];
                    iceCandidatesQueueRef.current[fromId].push(signal.ice);
                }
            }
        }
    }

    // FIX: setNewMessages now uses the functional updater on newMessages
    // instead of referencing the unrelated prevMessages state.
    let addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            { sender: sender, data: data }
        ]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prev) => prev + 1)
        }
    }

    let connectToSocketSerevre = () => {
        socketRef.current = io.connect(server_url, { secure: false })
        socketRef.current.on("signal", getMessageFromServer)

        socketRef.current.on("connect", () => {
            socketRef.current.emit("join_call", window.location.href)
            socketIdRef.current = socketRef.current.id;

            socketRef.current.on("chat-message", addMessage)

            socketRef.current.on("user-left", (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id))
            })

            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((socketListId) => {

                    if (socketListId === socketIdRef.current) return;

                    if (connections[socketListId]) return;

                    connections[socketListId] = new RTCPeerConnection(peerConfigconnections)

                    connections[socketListId].onicecandidate = function (event) {
                        if (event.candidate != null) {
                            socketRef.current.emit("signal", socketListId, JSON.stringify({ "ice": event.candidate }))
                        }
                    }

                    connections[socketListId].ontrack = (event) => {
                        console.log("🎥 STREAM RECEIVED");

                        setVideos((prevVideos) => {
                            let videoExist = prevVideos.find(video => video.socketId === socketListId);

                            let updatedVideos;
                            if (videoExist) {
                                updatedVideos = prevVideos.map(video =>
                                    video.socketId === socketListId ? { ...video, stream: event.streams[0] } : video
                                );
                            } else {
                                updatedVideos = [...prevVideos, {
                                    socketId: socketListId,
                                    stream: event.streams[0],
                                    autoPlay: true,
                                    playsinline: true
                                }];
                            }

                            videoRef.current = updatedVideos;
                            return updatedVideos
                        })
                    };

                    if (window.localStream === undefined || window.localStream === null) {
                        let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
                        window.localStream = blackSilence();
                    }

                    if (id === socketIdRef.current) {
                        for (let id2 in connections) {
                            if (id2 === socketIdRef.current) continue

                            try {
                                window.localStream.getTracks().forEach(track => {
                                    connections[id2].addTrack(track, window.localStream);
                                });
                            } catch (e) { console.log(e) }

                            connections[id2].createOffer().then((description) => {
                                connections[id2].setLocalDescription(description)
                                    .then(() => {
                                        socketRef.current.emit("signal", id2, JSON.stringify({ "sdp": connections[id2].localDescription }))
                                    })
                                    .catch(e => console.log(e))
                            })
                        }
                    }
                })
            })
        })
    }

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);

        connectToSocketSerevre();
    }

    let routeTo = useNavigate();

    let connect = () => {
        setAskForUsername(false);
        getMedia();
    }

    let handleVideo = () => {
        setVideo(!video);
    }

    let handleAudio = () => {
        setAudio(!audio);
    }

    let getDisplayMediaSuccess = (stream) => {
        try {
            window.localStream.getTracks().forEach(track => track.stop())
        } catch (e) { console.log(e) }

        window.localStream = stream;
        localVideoRef.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;

            connections[id].addStream(window.localStream);
            connections[id].createOffer().then((description) => [
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit("signal", id, JSON.stringify({ "sdp": connections[id].localDescription }))
                    })
                    .catch(e => console.log(e))
            ])
        }

        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false);

            try {
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            } catch (e) { console.log(e) }

            let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            localVideoRef.current.srcObject = window.localStream;

            getUserMedia();
        })
    }

    let getDisplayMedia = () => {
        if (screen) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
                    .then(getDisplayMediaSuccess)
                    .then(stream => { })
                    .catch((e) => console.log(e))
            }
        }
    }

    useEffect(() => {
        if (screen !== undefined) {
            getDisplayMedia();
        }
    }, [screen])

    let handleScreen = () => {
        setScreen(!screen);
    }

    let sendMessage = () => {
        socketRef.current.emit("chat-message", username, message);
        setMessage("");
    }

    let handleEndCall = () => {
        try {
            let tracks = localVideoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop())
        } catch (e) { }

        routeTo("/home");
    }

    return (

        <div>

            {askForUsername === true ?

                <div>

                    <h2>Enter info lobby</h2>

                    <TextField id="outlined-basic" label="username" value={username} onChange={e => setUsername(e.target.value)} variant="outlined" />
                    <Button variant="contained" onClick={connect}>Connect</Button>

                    <div>
                        <video ref={localVideoRef} autoPlay muted></video>
                    </div>
                </div> :

                <div className={styles.meetVideoContainer}>
                    {showModel ? <div className={styles.chatRoom}>
                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>

                            <div className={styles.chattingDisplay}>

                                {messages.length > 0 ? messages.map((item, index) => {
                                    return (
                                        <div style={{ marginBottom: "20px" }} key={index}>
                                            <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                                            {/* FIX: show item.data (the message text), not item.sender again */}
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }) : <p>No messages yet</p>}

                            </div>
                            <div className={styles.chattingArea}>
                                <TextField id="outlined-basic" value={message} onChange={(e) => setMessage(e.target.value)} label="Enter your chat" variant="outlined" />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>
                        </div>
                    </div> : <></>}


                    <div className={styles.buttonContainers}>

                        <IconButton onClick={handleVideo} style={{ color: "white" }}>
                            {(video === true) ? <VideocamIcon /> : <VideocamOffIcon />}
                        </IconButton>
                        <IconButton onClick={handleEndCall} style={{ color: "red" }}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton onClick={handleAudio} style={{ color: "white" }}>
                            {audio === true ? <MicIcon /> : <MicOffIcon />}
                        </IconButton >

                        {screenAvailable === true ?
                            <IconButton onClick={handleScreen} style={{ color: "white" }}>
                                {screen === true ? <ScreenShareIcon /> : <StopScreenShareIcon />}
                            </IconButton>
                            : <></>}

                        <Badge badgeContent={newMessages} max={999} color='secondary'>
                            <IconButton onClick={() => setShowModel(!showModel)} style={{ color: "white" }}>
                                <ChatIcon />
                            </IconButton >
                        </Badge>
                    </div>

                    <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted></video>

                    <div className={styles.conferenceView}>
                        {videos.map((video) => (

                            <div key={video.socketId}>

                                <video

                                    data-socket={video.socketId}
                                    ref={ref => {
                                        if (ref && video.stream) {
                                            ref.srcObject = video.stream;
                                        }
                                    }}
                                    autoPlay
                                >

                                </video>
                            </div>
                        ))}
                    </div>
                </div>

            }
        </div>
    )
}
