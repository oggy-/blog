---
layout: post
title:  "Coordination Problems in Distributed Systems"
date:   2023-07-21 16:45:08 +0200
categories: jekyll update
tag: distributed systems
tag: leader election
tag: distributed commit
tag: consensus
---

*Avoiding* coordination in distributed systems is a hot topic in computer science and engineering.
Coordination hurts both the availability and the performance of your system.
Nevertheless, sometimes the problem you're solving simply requires coordination.
Even worse, such problems are often **not even solvable at all** without some non-trivial assumptions on your system!
In this post, I'll describe three ubiquitous coordination problems, and the conditions under which they can be solved.
My hope is that it will help you to (1) recognize the problems on your hands is an instance of one of these prblems and (2) not waste your time trying to solve impossible problems (quoting I.N. Herstein, "there are more profitable and pleasanter ways of wasting your time").
The reading time should be 15-20 minutes.

The problems are:

1. *Consensus (aka total-order broadcast)*, important for replicating a computation.
2. *Distributed commit*, when you need to transact over multiple data partitions (shards).
3. *Distributed leader election* and *mutual exclusion*, important for failover.

I can attest to them being practical since I've run into all of them.[^credentials]
But before going to the problems themselves, let's first look at the basic reason why problems can become unsolvable in distributed systems, and at the different properties of distributed systems that influence solvability.

## Damned If You Do, Damned If You Don't ##

The basic source of coordination problems in distributed system is relatively simple.
It's the combination of delays and failures.
Have a look at the figure below.

![A successful, a delayed, and a failed message between two processes](distributed-failures.png)

Say we have two distributed processes that need to coordinate on something.
At time t<sub>1</sub>, the first process sends a message to the second one.
Three things can happen here:

1. The message will be delivered to the second process in a timely manner.
2. The message will be delayed.
3. The message will never get to the second process. 
   This can happen either if the network loses the message, or if process 1 crashes while sending the message.

Now imagine you're the second process at time t<sub>2</sub>.
You're trying to coordinate with the first process, but no messages are arriving.
Maybe you know you're supposed to hear from them by t<sub>3</sub>, so you decide to wait until t<sub>3</sub>.
But if still no message arrives by then, what do you do?
You can sit and wait, hoping that the message just got delayed and will eventually arrive.
But if it doesn't -- because it got lost or because the first process crashed -- you'll end up waiting forever, and whatever you're trying to do will never get done.
This would destroy the so-called *liveness* properties of your system, that (very informally) ask that your system eventually does something useful.

The other option you have is to not wait and just proceed to do something.
But if that something is, say, pulling out the control rods in your fission reactor, and if the message from the other process was trying to tell you that it had already pulled the rods out, you can see how this might be a bad idea.
It would destroy (obliterate?) the *safety* properties of your system, which ask that your system doesn't get into a bad state.

So that's your fundamental problem of distributed systems, the tension between safety and liveness.
To still be able to get both safety and liveness in problems that require coordination, you will normally have to make some assumptions on the root causes: failures and delays.
So let's next talk about some standard assumptions.
I'll also talk a bit about the academic models that rely on these assumptions to examine the solvability conditions of the different problems.

## Assumptions and Spherical Cows ##

Solving a coordination problem will typically require assumptions on one or both of the following phenomena:

1. Failures. 
   Most commonly, solving a problem may require an upper bound on the number of processes that may fail during the execution of the protocol.
   For example, often you will have an assumption of "less than a half of the processes may fail".
   Less commonly, instead of processes, sometimes the number of network failures (message losses and/or alterations) is bounded instead.
   The other important aspect of failures is whether they are include only process crashes and message losses, or if they also include processes that behave incorrectly or maliciously and message alteration.
   In the latter case, you're looking at a Byzantine setting, as opposed to the "benign" one; to keep this post to a reasonable length, I'll assume we're looking at the benign case.

2. Delays.
   Solving a problem may require bounds on the drift between the clocks of the involved processes, processing time, and message delivery time.
   Note that a message that is lost may also be interpreted as an indefinitely postponed message.
   
On the face of it, this is a smallish set of assumptions, and you could classify systems based on whether a particular assumption holds.
Distributed systems theoreticians usually distinguish between two classes of systems: synchronous (where all of the mentioned bounds on delays hold), and asynchronous (where one or more of them don't hold).
This provides them with relatively simple models to investigate the different coordination problems and the conditions for solving them.
The theoreticians' conclusions are very useful as a guidance, but you must bear in mind that their models are "spherical cows", a very simplified view of reality.
For example, take the assumption on failures: a theoretical result may tell you that you can only solve a particular problem if at most 2 out of your 5 processes fail.
Usually the model will use a "crash-stop" assumption, where a process fails once and then stays dead forever.
But in practice, you'll usually want to reboot a node or a process if you can, yet the model won't tell you what happens if you do.
Somewhat paradoxically, it may happen that rebooting the node makes a solution no longer work under certain weird circumstances.

Often, the most important consequence of these assumptions is whether they enable one process to answer the question "is this other process running now", whether that answer is reliable.
For example, you can make processes exchange regular heartbeats and measure how long it usually takes to propagate a heartbeat.
If process 2 doesn't hear a heartbeat from process 1, it can guess that process 1 is not running.
If you assume that there are no delays (including clock drifts), then the guess will always be correct.
However, if you assume that most of the time there are no drifts and delays, then the answer will usually be correct, but not always.
The notion of failure detection has also been extensively researched in the distributed system theory.
Problems are often classified in the theory literature by how reliable failure detection must be to solve them.
But like with assumptions, there are some caveats involved and you need a bit of practice in interpreting the results.[^caveat-fd]

I don't want to cover every detail in this post, but I hope this gives you enough intuition on the kind of assumptions that we'll need for solving concrete problems.

## Consistent Replication (Consensus) ##

The first problem we'll look at is when you must replicate a system, usually in order to make it fault-tolerant.
To keep the system simple for its users, often you want to make the replicas consistent, i.e., indistinguishable from a single centralized system from the users' point of view.[^linearizable]
There are a few ways of doing this: primary-backup, passive, and active replication.
We'll look at the primary-backup again in the last section.
The latter two require solving the *consensus* or *total-order broadcast* problem.
This problem amounts to putting all users' operations - or their results - in some order on which all replicas agree on.
This way, all replicas go through the same sequence of states.
In general, consensus is the problem of *jointly determining the order of things* in a distributed system.

As in all the problems we'll look at, there's a safety vs. liveness tension here.
For example, replica 1 has to eventually decide which user operation should come first; if it doesn't, the system will get stuck (liveness is lost).
But if replica 1 decides prematurely to take the user 1's operation as the first one, while replica 2 thinks that user 2's operation should go in first, consistency (and thus safety) is violated.

In practice, to solve the consensus problem, your system must satisfy the following assumptions:

1. More than half of the processes in your system will be running correctly (they may crash and recover).
   In the periods where less than a half of them are running, your system will be stuck (no liveness).
   
2. Most of the time, all delays in the system will be within some known limits. 
   In the periods where the limits are broken (i.e., network partitions), your system will be stuck.[^no-consistency]
   
These are fairly reasonable assumptions for a distributed system.
That is, you can in practice always solve consensus if your system must provide consistency.

## Transactions (Distributed Commits) ##

Often, your system's data will be too big to fit on a single node, and you'll have to distribute it among different nodes called *shards*.
Still, the users might require changing several pieces of data *atomically*, i.e., a *transaction* on the data where either all the data pieces are changed, or none of them are.
Usually there are conditions attached on whether a piece of data can be changed.
For example, the user might want to increment a counter only if it doesn't hit a certain limit.
In more realistic scenarios, there might be multiple transactions issued, and the conditions are that the data changes of one may not conflict with the data changes of the other.
If there are conditions attached to the data changes, and if atomicity must hold regardless of whether the data pieces sit on a single shard or not, then you must solve the *distributed commit* (aka *distributed atomic commit*) problem.

In this problem, all involved shards start from their initial local yes/no answers (saying whether their local pieces of data may be changed as the user wants).
The goal is to have every shard output a final yes/no answer (the existence of the answer gives us liveness).
The answer has to be the same at every shard; otherwise, atomicity (i.e., safety) is lost.
Furthermore, the final answer is allowed to be "no" only if some shard gave an initial "no" answer, or if one of the shards fails (also safety).
This condition prevents the trivial solution where final answer is always "no".

Unsurprisingly, solving this problem requires collecting the initial answers from all involved shards in some way.
The safety-liveness tension appears in the case where this answer is missing from a shard: do we give out "no" as the final answer (and potentially violate safety), or do we keep on waiting on the shard (potentially violating liveness)?
Solving the problem fully requires us to reliably detect whether the shard has failed.
In practice, this translates to assumption that delays in the system are always within some known limits.

Unfortunately, actual distributed systems don't really fulfill this assumption.[^could-add-stonith]
So in practice you might choose to, well, just sometimes take "no" for an answer.
If you're not that type, another option you have is to *replicate* each shard (using consensus).
Then, you can assume that every shard will reply and just keep waiting on the response, and never give out an unwarranted "no" answer.

## Failover (Leader Election) ##

Sometimes, you will have several nodes that share a single resource.
A classic example is failover for high availability.
Here, you have an active and a passive node (or nodes) that share storage and IP addresses.
If the active node crashes, you want to fail over to the passive node and activate it.
Sometimes you event want that node to take over the active IP connections such that the clients do not notice anything but perhaps a slight delay.
But what you very much want to avoid is the *split-brain* scenario, where both nodes think that they are now active.
This requires solving the *leader election* problem.
Here, every node must eventually decide on a node whom they view as the leader (the liveness property).
Yet, there shouldn't be a split brain, i.e., no two nodes may decide on two different leaders at the same time (the safety part).

Unsurprisingly, this problem requires the passive replica(s) to reliably detect the failure of the active one.
If the detection isn't reliable, and the passive replica thinks that the active one died even if it hasn't, you're in trouble.
There are a few ways to get practical reliable detection in this case:

1. If both of your active and passive nodes are sitting in a single data center, there's specialized hardware that you can use to monitor the active node and send the heartbeats to the passive one.
   The heartbeats should go over a reliable, dedicated network connection, and the clocks on the two nodes must be reasonably well synchronized.
   The combination of specialized hardware and a dedicated network channel allow you to assume that there are no delays.
   
2. You can ensure that the passive node's guess that the active node has failed by having the passive node, well, shoot the active node.
   It can do this by performing a software reset on the active node (which won't work if the active node is frozen), or by sending a message to a specialized hardware device that crashes the active node.
   The name of this "failure detection" scheme is one of the greatest double-yet-single entendres of computer science, STONITH (shoot the other node in the head).
   In addition to the fragility of software resets, another danger here is that delays may cause the nodes to end up shooting each other.
   
3. You may use *distributed leases* for leader election.
   These give a time-bounded "leader term" to one of the processes.
   If your leases specify disjoint time intervals, and (here comes the assumption!) if the nodes' clocks are reasonably well synchronized, there's your solution.
   The difficulty here is then mainly on how to ensure the disjoint lease intervals.
   In theory you could use a fixed upfront distribution (e.g., you rotate 1-second leases among the nods), but this is obviously not ideal if one of your nodes actually crashes for a longer period.
   A more practical alternative is have the nodes issue lease requests on-demand, and then totally order the lease requests using consensus, with a first-wins policy on overlapping intervals.
 
Another case where leader election is necessary is the primary-backup replication mentioned earlier; the leader election determines who the primary is.
Confusingly enough, there's another, weaker, flavor of the leader election problem, where it's OK to have two leaders simultaneously as long as you eventually switch to a single one.
Thus, if you need failover and a system promises to give you "leader election", check whether and how it actually protects you from having two leaders at the same physical time.

As you see, leader election is a fairly thorny problem.
It's thus worth thinking whether you can work around it in some way.
For example, if the resource that the active and passive are sharing implements some kind of coordination primitives (e.g., locking), you may want to rely on those rather than solving the more complicated problem.


[^credentials]: I spent most of my [PhD thesis](https://www.research-collection.ethz.ch/bitstream/handle/20.500.11850/130815/eth-50878-02.pdf) on consensus, but was also involved in academia/industry collaboration on failover mechanisms; I then spent 3.5 years working on a [distributed commit protocol](https://canton.io), and recently spent half a year improving a [consensus algorithm](https://internetcomputer.org/how-it-works/consensus).
    
[^caveat-fd]: I once saw a result that showed that in a particular model of failures, achieving eventual consistency is no easier than achieving consistency.
    Upon seeing it, a noted researcher exclaimed that the result has "just killed eventual consistency".
    But in reality, eventual and strong consistency are quite different, and the result marked the boundary of where the model stops being useful.

[^linearizable]: This is defined formally through the concept of linearizability.

[^no-consistency]: The other option is to violate consistency; but I'm assuming 

[^could-add-stonith]: You could possibly make them fulfill the assumption by using leases or a STONITH-like solution, but that would be largely defeating the purpose.
