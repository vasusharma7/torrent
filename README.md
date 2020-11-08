<center><h1><b> VS Torrent </b></h1> </center>
<center><h3><b> BitTorrent Cleint </b></h3> </center>

<hr/>

**Features**

 - Downloading from Peers and Uploading to Peers
 - Algorithms Implemented - Rarest First, Top Four, Optimistic Unchoke, End-game
 - Seeding
 - Supports seeding across NAT also
 - Download and Upload Speed Control
 - Maximum Peer Connection Control
 - Make New Torrent
 - Supports CLI + GUI
 
 <hr/>
 
 **Tech Stack Used**
 
  - NodeJS
  - Electron for Native Application (GUI)
  - Electron - Photon framework for GUI Components
  
 <hr/>
 
**Asynchronous Programming in Node JS - Reason to choose Node JS**

<p>NodeJS runs asynchronously by default and there is no concept of multi threading in foreground. But all the asynchronous tasks are assigned to the event loop of NodeJS. This is even true for V8. The event loop is written in C++ and the good thing is that C++ supports multi threading. So, conceptually seeing, node-js has C++ code written for running its asynchronous tasks, which spwans multiple threads for running it.
So, we acheive multi threading without even coding for that. But that is true only for asynchronous tasks like API fetching, Network Oriented Tasks, file system based tasks. Some of the CPU intensive tasks such as calculating hashes in crypto library or image processing takes time because they are synchronous in nature. Node has a solution for that too. Node JS has 4 threads in its thread pool which means that it can actually run 4 synchronous tasks parallely without performance loss but slows down if more than 4 are run together.
Proportion of C++ code is 1/3 in node , rest is itself JS.</p>
