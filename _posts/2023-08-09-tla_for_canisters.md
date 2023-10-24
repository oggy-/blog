---
layout: post
title:  "Tutorial: Using TLA+ for Internet Computer Canisters"
date:   2023-08-09
comments: true
tag: TLA+
tag: formal verification
tag: smart contracts
tag: Internet Computer
toc: true
---

In a post earlier this year. I highlighted the [benefits of applying
TLA+](https://medium.com/dfinity/eliminating-smart-contract-bugs-with-tla-e986aeb6da24)
to Internet Computer’s canister smart contracts.
[TLA+](https://lamport.azurewebsites.net/tla/tla.html) is a language and toolkit for specifying and verifying complex
systems. In the realm of smart contract security, TLA+ is particularly
good at weeding out reentrancy bugs, a frequent type of smart contract
bugs that often have disastrous consequences. However, TLA+ is a
general-purpose language; it’s in no way tailored to smart contracts,
and in particular the Internet Computer (IC) and its so-called canister
smart contracts. Hence, figuring out how to use TLA+ to model canisters
can take time; this post is intended to help you with that. It’s a
technical guide that describes a general strategy for modeling canisters
using TLA+.

To understand this strategy, you’ll need to understand the following:

1.  The execution model of the IC

2.  The general structure of TLA+ models (the “meta-model” of TLA+)

3.  How to map the IC execution model onto the above general structure

4.  The types of properties that can be analyzed using TLA+

5.  The practical side of how to run the analysis

Quite a few things – so be ready for a longish post. If you’re familiar
with some of the above, just skim through the sections that cover what
you already know – I’ll add a TLDR to the end of each section to help
you decide if you want to read it. As in the introductory post, our
running example will be the chain-key Bitcoin (ckBTC) minter canister,
which performs the BTC \<-\> ckBTC conversions. To prevent this post
from turning into a book, I’ll limit the exposition of TLA+ to the
minimum required to understand the strategy. There are already other
excellent resources on TLA+ that I’ll refer to throughout the text, and
also list them at the end of the post.

But before going through the strategy in detail, let’s allow ourselves
to have some fun. Let’s dive in head first and let the TLA+ tools
discover the ckBTC bug from the introductory post, and then verify the
fix.

<span id="anchor-1"></span>
# TLA+ in action

Let’s make our TLA+ beginner lives a bit easier by using an IDE. To set
yourself up:

1.  Get [VSCode](https://code.visualstudio.com/) if you don’t already
    have it.

2.  Install the [TLA+
     extension](https://marketplace.visualstudio.com/items?itemName=alygin.vscode-tlaplus)
    for VSCode.

3.  Clone this TLA+ models repository: https://github.com/dfinity/tla-models

4.  Set up the TLA+ extension to work with the provided models. To do
    so, run the init-vscode.sh script in the cloned repository root.
    Make sure that this created a .vscode/settings.json file in the
    cloned repository (the file sets up some paths so we can use the
    TLA+ “standard library”).

5.  Open the cloned repository folder in VSCode.

Next, let’s run the ckBTC model in VSCode:

1.  Open the file blog/Ck_BTC.tla.

2.  Bring up the VSCode command palette (under View/Command Palette).

3.  Type in TLA+: Check model with TLC.

Another windowpane should open up, titled TLA+ model checking. After a
few seconds, you should see this line displayed:

```
Errors: 1 error(s)
```
Scrolling further down in the TLA+ model checking pane, you will see a
message that the system violated the Inv_No_Unbacked_Ck_BTC property. We
minted unbacked ckBTC, i.e., ckBTC where no corresponding BTC is owned
by the canister, which from the [introductory
post](https://medium.com/dfinity/eliminating-smart-contract-bugs-with-tla-e986aeb6da24)
you know is a no-no. This message is followed by the so-called *error
trace*: the sequence of steps that lead to the error. The steps are a
TLA+ version of the [error
diagram](https://medium.com/dfinity/eliminating-smart-contract-bugs-with-tla-e986aeb6da24#75d4)
from our introductory post (really, now is a good time to read it if you
haven’t yet). It’s worth spending a minute trying to make the connection
between the error trace and the error diagram; in particular, it’s
helpful to look at the title of each step of the trace (e.g.,
BTC_Network_Loop or Update_Balance_Start), and also what has changed
from one step to the next (there’s a letter M to the right of each
variable that changed). In the last state of the trace, look at the
`balance` and `btc` fields, representing the ckBTC balances and the state of
the Bitcoin network respectively. It should look something like this
(some details may differ in your trace, as there are different ways to
recreate the error):

|               |                                                                                              |
|---------------|----------------------------------------------------------------------------------------------|
| balance (1) M | [owner \|-> P1, subaccount \|-> S0] :> 6)                                                    |
|---------------|----------------------------------------------------------------------------------------------|
| ▶ btc (1)     | {[amount \|-> 3, id \|-> <<1063594549, 1>>, owner \|-> [owner \|-> P1, subaccount \|-> S0]]} |


Here `[x |-> a, y |-> b]` is TLA+ syntax for a record (struct) with
fields `x` and `y` and values `a` and `b` respectively, and `x :> y` is the TLA+
syntax for “x maps to y”. In plain English, the `balance` field says that
the ckBTC balance of subaccount `S0` of the principal (IC term for a user
identifier) `P1` is 6. The `btc` field lists the current UTXOs (unspent
    transaction outputs, the “live Bitcoin“) on the Bitcoin network. There’s
only one such UTXO, which is indeed controlled by the deposit account of
principal `P1` and subaccount `S0`, but it only holds 3 units – so there’s
indeed more ckBTC minted than there’s Bitcoin to back it up.

To fix the error, we can use locking, as explained in the introductory
post. Uncomment the statement at line 505 of the Ck_BTC.tla file by
changing it from

```
\* locks := locks \union {caller_account.owner};
```

to

```
locks := locks \union {caller_account.owner};
```

Let’s re-run the analysis; click on “Check again” at the top of the
model checking pane, or bring up the command palette again and run TLA+:
Check model with TLC. After a few more seconds, the model checking pane
should show a line saying:

```
Success: Fingerprint collision probability: 3.8E-9
```

Bye-bye error! Fab! Done! But... maybe let’s try to understand what we
just did here? Well, we found (and fixed) problems with a canister’s
execution, so let’s start by understanding how IC canisters are
executed.

<span id="anchor-2"></span>
# The Internet Computer Execution Model

At a high level, a canister exposes *methods* which can be called by
users and other canisters. The methods do some computation and
eventually return a response to the caller. However, the full story –
and the source of re-entrancy bugs, like the one we witnessed above – is
a bit more complicated than that.

A single method can consist of multiple *message handlers*. Each message
handler takes a message, which can be either a request (by a user or
another canister), or a response (by another canister), and produces
either a response (which finishes the execution of the method), or
another request (to another canister)<sup>[^1]</sup>. Additionally, the
message handler can change the canister’s state. This state is just the
canister’s Wasm memory.

Deceivingly, message handlers are not obvious when you look at the
source code of a canister method, at least as the methods are usually
written in Rust or Motoko. For example, let’s look at the
[update_balance](https://github.com/dfinity/ic/blob/24147debbe62230993ca74d171337c4c4430ad1c/rs/bitcoin/ckbtc/minter/src/updates/update_balance.rs#L84)
method of the ckBTC minter canister.<sup>[^2]</sup> At the moment, let’s
just look at the method’s high-level structure; we’ll look at the
details later.

<figure>
{% highlight rust linenos %}
pub async fn update_balance(
   args: UpdateBalanceArgs,
) -> Result<UpdateBalanceResult, UpdateBalanceError> {
   let caller = ic_cdk::caller();

   let _guard = balance_update_guard(args.owner.unwrap_or(caller))?;

   let caller_account = Account {
       owner: PrincipalId::from(args.owner.unwrap_or(caller)),
       subaccount: args.subaccount,
   };

   let address = state::read_state(|s| {
       // Convert the ckBTC address to a BTC one
       get_btc_address::account_to_p2wpkh_address_from_state(s, &caller_account)
   });

   let min_confirmations = state::read_state(|s| s.min_confirmations);

   let utxos = get_utxos(btc_network, &address, min_confirmations)
       .await?
       .utxos;

   let new_utxos: Vec<_> = state::read_state(|s| {
       let existing_utxos = s
           .utxos_state_addresses
           .get(&caller_account)
           .unwrap_or(&BTreeSet::new());
       let finalized_utxos = s
           .finalized_utxos
           .get(&caller_account.owner)
           .unwrap_or(&BTreeSet::new());
       BTreeSet::from_iter(new_utxos)
           .difference(&existing_utxos.union(finalized_utxos))
           .collect()
   });

   // Remove pending finalized transactions for the affected principal.
   state::mutate_state(|s| s.finalized_utxos.remove(&caller_account.owner));

   let satoshis_to_mint = new_utxos.iter().map(|u| u.value).sum::<u64>();

   if satoshis_to_mint == 0 {
       return Err(UpdateBalanceError::NoNewUtxos {
           required_confirmations: min_confirmations,
       });
   }

   let mint_txid = mint(satoshis_to_mint, caller_account.clone())
       .await?;

   state::mutate_state(|s| state::audit::add_utxos(s, Some(mint_txid), 
      caller_account, new_utxos));

   Ok(UpdateBalanceResult {
       amount: satoshis_to_mint,
       block_index: mint_txid,
   })
}
{% endhighlight %}
<figcaption>
Figure 1: The update_balance method of the ckBTC canister.
</figcaption>
</figure>

Even though this is a single Rust function, this method actually defines
*three* different message handlers:
1. The first handler consists of lines 4-26, finishing with the call to get_utxos, which sends a message to the Bitcoin canister asking about the UTXOs that are owned by address.
1. The second handler consists of lines 27-59; it processes the response from get_utxos, and finishes with the call to mint.
1. The third and last message handler then processes the response from mint, and completes the execution of the method.

In general, message handlers are
separated by the `await` keywords in the code. Under the hood, the
compiler (both in Rust and Motoko) transforms the code after every await
on an inter-canister call into a separate function, which then handles
the response of the awaited call.

Each message handler is executed *atomically* (in isolation), i.e., that
is, no other message handler of that same canister can be running at the
same time. In other words, when a message handler starts executing, it
gets exclusive access to the canister’s Wasm memory until it’s done
executing. Crucially, while two *message handlers* can’t execute at the
same time, two *methods* **can** -- the execution of the method’s message
handlers can be *interleaved*.

Make sure that you fully wrap your head around that as it’s the single
most important feature of the IC execution model for the purposes of
this post! For example, two users Alice and Bob could call
update_balance at the same time. One possible execution of the two calls
is as follows (other schedules are also possible).

<figure>
<img src="/blog/assets/tla_canisters_tutorial/interleavings.png"/>
<figcaption>Figure 2: A possible interleaving of two update_balance calls</figcaption>
</figure>


Alice’s call could get scheduled first; the first message handler sends
the `get_utxos` message to the Bitcoin canister. While this message is in
flight, Bob’s execution can proceed to also execute the first message
handler. Importantly, this execution encounters the canister state left
by Alice’s message handler; the methods are really executed
concurrently. Then, while Bob’s execution awaits the UTXOs, the response
to Alice’s message could come back and be executed by the second message
handler, resulting in a mint message to the ckBTC ledger canister. The
response to the mint message may well be received before Bob’s UTXOs
arrive, finishing the execution of Alice’s call. After that, Bob’s call
is run to completion in a similar way.

For more examples, I recommend you have a look at the canister security
[best practices
guide](https://internetcomputer.org/docs/current/developer-docs/security/rust-canister-development-security-best-practices#message-execution-basics),
which also lists some common pitfalls of this execution model.

**TLDR**: In the IC execution model, each canister method may consist of
multiple *message handlers*, which receive a single message and are then
atomically executed to produce a request or response. Method calls can
execute concurrently, by interleaving their message handlers. To
identify the handlers, look for `await` statements in the methods.

To model canisters in TLA+, you’ll have to map this execution model onto
TLA+. Let’s first understand what TLA+ looks like in general.

<span id="anchor-3"></span>
# The Anatomy of a TLA+ Model

TLA+ is a language for describing *transition systems*, also called
*state machines*. A transition system models how the state of a computer
system (e.g., a program or a software component) can evolve over time.
You might already be familiar with similar concepts such as
deterministic finite automata used to describe finite state machines.
The TLA+ state machines are a slightly more general version of the same
concept. Here’s the TLA+ model that describes the transition system of a
simple integer counter that starts at 0 and increments forever; you can
find it in the repository as blog/Counter.tla.

{% highlight tla %}
---- MODULE Counter ----
EXTENDS Naturals

VARIABLE cnt

Init == cnt = 0

Next == cnt + 1 = cnt'

====
{% endhighlight %}

To specify how the states evolve, a TLA+ transition system (defined in a
TLA+ module) defines:

1.  A set of state variables to describe how the states look like. In
    the example the states have just one variable, `cnt`.

2.  The initial (starting) states of a system using an *initial
    predicate*. This is just a Boolean predicate on states; a state is
    initial if the predicate evaluates to true in that state. In the
    example, the initial predicate Init is true if `cnt` is equal to 0.

3.  How and when one can move (transition) from one state to another,
    via a *transition predicate*. The predicate is conceptually a
    Boolean-valued function `Next(s, s’)` that maps a pair of states to
    either true or false, saying whether we are allowed to move from
    the state `s` to the state `s'`. Concretely, it’s written as a formula
    relating the variables of s to the variables of `s’`, where the
    “primed” variables (ending in ’, such as `cnt'`) refer to the
    successor state `s'`, and the unprimed variables (such as `cnt`) refer
    to the predecessor state `s`. Note that `Next` is just something that
    evaluates to true or false; what we wrote is exactly equivalent to
    the following, more conventional way of writing that predicate:  

    `Next == cnt’ = cnt + 1`

    The second form looks like an assignment in a standard programming
    language, but it’s still just a predicate – this is a common
    stumbling block for people learning TLA+.

Together, these three things define the possible *traces* of the
transition system, which are the allowed sequences of states that the
system can go through. In general, a trace is a sequence of states of
the form:

s<sub>0</sub>, s<sub>1</sub>, s<sub>2</sub>, …

where:

1.  s<sub>0</sub> has to belong to the set of initial states, and

2.  Each pair of successive states has to satisfy the transition
    predicate.<sup>[^3]</sup> That is, Next(s<sub>0</sub>,
    s<sub>1</sub>), Next(s<sub>1</sub>, s<sub>2</sub>),
    Next(s<sub>2</sub>, s<sub>3</sub>), and so on, must all evaluate
    to true.

So the much only allowed trace of our example system is:

`[cnt |-> 0], [cnt |-> 1], [cnt |-> 2], [cnt |-> 3], …`

<span id="increment-example"></span>
What happens if we change the transition predicate in the above model as
follows?

{% highlight tla %}
Next ==
  \/ cnt' = cnt + 1
  \/ cnt' = cnt + 2
{% endhighlight %}

The `\/` operator stands for “or” (TLA+ has indentation-based parsing
rules for conjunctions and disjunctions). The predicate is now satisfied
if the value of variable `cnt` in the successor state is 1 or 2 above the
value of `cnt` in the predecessor state. We’ve just described a
non-deterministic transition, where each state can have more than one
successor. And suddenly, our transition system defines an infinite
number of traces, instead of just one. For example, all three of the following
traces are allowed

`[cnt |-> 0], [cnt |-> 1], [cnt |-> 2], [cnt |-> 3], …`

`[cnt |-> 0], [cnt |-> 2], [cnt |-> 4], [cnt |-> 6], …`

`[cnt |-> 0], [cnt |-> 1], [cnt |-> 3], [cnt |-> 4], …`

There’s a small complication that I’ll mention here that will become
relevant once we try to verify our models. From a theoretical TLA+
perspective, all of the following transition predicates are equivalent:

{% highlight tla %}
Next ==
  \/ cnt' = cnt + 1
  \/ cnt' = cnt + 2
{% endhighlight %}

{% highlight tla %}
Next ==
  \/ cnt + 1 = cnt'
  \/ cnt = cnt' - 2
{% endhighlight %}

{% highlight tla %}
Next == cnt' - cnt \in 1..2
{% endhighlight %}

However, the verification tools, i.e., the tools that analyze the
transition system to see whether it satisfies some specified properties
can only cope with the first of the above forms, and will complain if
you use the second or third form. In general, the verification tools
support only a part of the full TLA+ language. For the main verification
tool, TLC, you can find the details on the supported language parts in
the [TLA+ book](https://lamport.azurewebsites.net/tla/book.html).

Like the transition predicate, the initial predicate can also be
non-deterministic. For example, we could allow the counter to start from
either 0 or 1 by writing:

{% highlight tla %}
Init == cnt \in {0, 1}
{% endhighlight %}

Meaning that cnt can take a value from the set {0, 1}.

**TLDR**: TLA+ models are transition systems defined by a set of
variables, and initial predicate, and a transition predicate. Together,
these define a set of traces. Non-determinism is expressible through
disjunction in predicates. The verification tools for TLA+ impose some
constraints on the TLA+ code that they can ingest.

In principle, we now know enough about TLA+ to go and model canisters.
However, we’ll first take a slight detour and describe PlusCal, which
will make the modeling process more convenient.

<span id="anchor-5"></span>
# PlusCal: Concurrent Imperative Programs in TLA+

PlusCal is a thin layer on top of TLA+ that was originally created to
simplify the modeling of concurrent imperative algorithms. Here’s one
way to write the second, non-deterministic version of our counter
specification using PlusCal, where the counter increases by either 1 or
2. You can find it in the file blog/Counter_Pluscal.tla.

{% highlight tla %}
---- MODULE Counter_Pluscal ----

EXTENDS Naturals

INCREASE_PIDS == {1}

(* --algorithm Counter {

variable cnt \in {0, 1}

process (Increase \in INCREASE_PIDS)
    variable
        increment;
{
Loop:
    with(i \in 1..2) {
        increment := i;
    };
    cnt := cnt + increment;
    goto Loop;
}

} *)
====

{% endhighlight %}

In PlusCal:

1.  The system is described as a collection of *processes*. In the
    example, we have one process that’s called `Increase`. A process is
    like a template for execution, and can be instantiated multiple
    times concurrently in a system, with each instance having a
    *process identifier*. This is similar to worker processes of a Web
    server for example, with each worker process running the same
    code. In this model, by the virtue of the `INCREASE_PIDS` set having
    one element, we allow just one instance of the `Increase` process –
    the single allowed process IDs here is 1. This specific IDs is an
    arbitrary choice, we also could have used a string such as
    `"PID_ONE"` instead. The type of the value doesn’t matter; in fact,
    PlusCal and TLA+ are completely untyped, giving a lot of freedom
    but also causing headaches sometimes.

2.  Each process instance has access to a local state that’s specific to the
    instance. In this case, there is a single local variable called `increment`.
    There is also a global state accessible by all processes and instances, in
    the example it consists of just a single variable `cnt`. We will use PlusCal
    local variables to model the local variables of canister methods.

3.  Each process consists of one or more atomically executed blocks,
    where each block gets assigned a label. In this example, our
    `Increase` process has only one block labeled `Loop`, that we jump
    back to (using the dreaded `goto` statement) once we’re done
    executing the block.

4.  We can model non-deterministic choice using the `with` statement. In
    the example, we non-deterministically choose the value of `i` from
    the set {1, 2}. The value is then available in the scope
    immediately following the with statement (delimited by curly
    braces), but not beyond that.

5.  Unlike TLA+, where we can refer to predecessor and successor state
    variables by priming variables or not; rather, we use the
    assignment operator to specify what the value of a variable in the
    successor state should be.

So far, we just came up with a more convoluted way to rewrite our TLA+
counter example. The magic starts when we introduce multiple labels per
process, however – and it’s exactly the kind of magic that’ll be useful
for modeling canisters. Consider the following modification to our
example above, which you’ll find in Counter_Interleaved.tla.

{% highlight tla %}
--- MODULE Counter_Interleaved ----

EXTENDS Naturals

INCREASE_PIDS == {1, 2}

(* --algorithm Counter {

variables
    cnt \in {0, 1};
    cumulative_increment = 0;

process (Increase \in INCREASE_PIDS)
    variable
        increment;
{
Loop:
    with(i \in 1..2) {
        increment := i;
        cumulative_increment := cumulative_increment + increment;
    };
Suspend:
    cnt := cnt + cumulative_increment;
    cumulative_increment := 0;
    goto Loop;
}

} *)
====

{% endhighlight %}

Here’s the breakdown of the changes:

1.  We’ve added a label `Suspend` to the process `Increase`. This changes
    how the process is executed. Instead of the entire loop being
    executed atomically, the execution is now split up into two atomic
    parts. The first part non-deterministically chooses a value for
    the increment, and the second one increments the counter.

2.  We introduced a new global variable `cumulative_increment`, which
    stores the local increment in the first part, and then is added to
    the counter `cnt` in the second part.

3.  We now allow two process instances instead of a single one (by adding another element to `INCREASE_PIDS`).

Together, this changes how our system behaves: the counter can now jump
up by 1, 2, 3, or 4 in one go! For example, the process instance with
PID 1 can first execute its first part, changing the value of
`cumulative_increment` from 0 to 2. But then the instance with PID 2 can
do the same, bumping `cumulative_increment` to 4. Finally, either of
the two instances can then proceed to bump cnt up by 4 in the second
part of the loop, resetting `cumulative_increment` to 0. As a mental
exercise, try to figure out whether this new behavior of counter jumping
up by more than 2 can still occur if we omit any of the three changes
listed above.

Crucially, this interleaving of process instances mirrors how the
message handlers of IC canister methods can be interleaved together –=
and we’ll soon put it to good use. But before we go there, I’ll spend a
few words on the relationship between PlusCal and TLA+.

PlusCal source code is compiled to TLA+ source code, what’s usually
referred to as transpilation. The transpilation process is a bit funky.
The PlusCal code itself is written inside of a TLA+ comment (!) – TLA+
block comments are delimited by `(*` and `*)`. The parser can then do the
transpilation, pasting the resulting TLA+ code after the comment
containing the PlusCal code. You can try this out: use VSCode to open
the above example, and then run the “Parse module” command from the
command palette.

In theory, you shouldn’t need to read or understand the TLA+
translation. But in practice, you will need to understand it relatively
soon; errors that you make in your PlusCal code will often be reported
only in terms of the TLA+ translation. Furthermore, understanding the
translation is also important for writing more advanced properties. Here
are the most important points of the translation process:

1.  Local variables of processes are generally modeled as maps whose
    keys are process IDs. There’s a special PlusCal syntax for
    singleton processes, which have just one instance – for those
    processes, the local variables are modeled as simply global
    variables.

2.  The translation introduces one TLA+ predicate for each PlusCal
    label. The transition predicate is then a disjunction of the
    form:  
    `Label1 \/ Label2 \/ Label3 \/ … `
    Where `LabelX` is the TLA+ predicate introduced for the PlusCal
    label `LabelX`.

3.  The translation introduces a local variable `pc` to each process,
    where pc stands for “program counter”. This variable tracks which
    label each process instance is executing next. The corresponding
    TLA+ predicate will always require that the program counter is set
    to that label before allowing the transition – this ensures that
    the control flow specified in PlusCal is respected.

**TLDR**: PlusCal is a sugar syntax on top of TLA+ that allows us to
describe transition systems using processes, each of which can have
multiple concurrently executing instances. Each instance can make use of
its own local variables. Processes contain one or more blocks, which are
delimited using labels in the source code. Each block is executed
atomically, but the execution of the different process instances can be
interleaved by interleaving the execution of their blocks.

OK, now we’re ready to put it all together and look at our strategy for
modeling canisters using PlusCal and TLA+.

<span id="anchor-6"></span>
# Mapping the IC Execution Model Onto TLA+

Let’s recap what we have so far:

1.  The basic execution block of a canister is a message handler, that
    takes in a single message sent to the canister, produces a new
    message or a response, and changes the canister’s state. Each
    message handler is run atomically. Handlers can be scheduled more
    or less arbitrarily, except that the response handlers (i.e.,
    those that come after an await) obviously can’t execute before the
    preceding handlers in the same method execute.

2.  TLA+ models describe the traces of a system (sequences of states
    that a system can go through), by defining the initial and
    transition predicates.

This leads to our high-level strategy of creating a TLA+ model of a
canister using PlusCal:

1.  The state of our model will consist of variables describing the
    messages that have been sent to the canister, the messages sent by
    the canister, and the canister’s state (i.e., its Wasm memory).

2.  We’ll create a PlusCal process for each method of our canister. Each
    instance of the process will correspond to a single method
    execution. We’ll simply use PlusCal local variables to model the
    method’s local variables.

3.  We’ll create a label for each message handler in the method. The
    label body will describe how the handler processes a message.
    We’ll use PlusCal control flow constructs (such as if/else, goto,
    or simple order of labels) to ensure that the model executes the
    different message handlers in the same order as the actual
    canister method does.

4.  The initial predicate for the model will define the initial states
    to contain no messages yet (neither incoming nor outgoing), and
    the canister state corresponds to the state of the Wasm memory of
    a freshly installed canister, whatever that is for your canister.

5.  Since the IC gives an ordering guarantee on requests delivered
    between a pair of canisters, we will have a single queue for each
    pair of canisters that talk to each other, modeling requests. For
    responses, there is no ordering guarantee. We’ll thus model
    responses using an unordered bucket of responses, i.e., a set of
    responses.

Additionally, we’ll almost always want to model the *environment* of the
canister: the other canisters or systems that the canister interacts
with. For example, for the ckBTC minter canister, we will want to model
the Bitcoin canister, the ckBTC ledger canister, and the Bitcoin network
itself. Typically, the models of these environment components will be
highly simplified, specifying just our assumptions on how the
environment behaves. I can’t give a strict recipe on how to do that;
this will require thinking and common sense on your part. The examples
in the repository will hopefully provide sufficient inspiration for how
to do this.

That’s the entire strategy at a high level – let’s now see how we can
put it to use!

<span id="anchor-7"></span>
# The Full Gory Details: Updating ckBTC Balances

Let’s return to our running example of updating ckBTC balances to see
how to model a realistic canister method. We’ll focus on the
`update_balance` method, so we will have just one process for the ckBTC
minter – additional methods would require additional processes. As
mentioned earlier, the ckBTC minter also requires access to the ckBTC
ledger and the Bitcoin canister in order to operate. We’ll later create
simplified models of these two as well, but we’ll start with just the
minter.

Let’s take it step-by-step and start with just the first message handler
of the update_balance method. We show the Rust code again, followed by
the corresponding PlusCal model

{% highlight rust %}
pub async fn update_balance(
   args: UpdateBalanceArgs,
) -> Result<UpdateBalanceResult, UpdateBalanceError> {
   let caller = ic_cdk::caller();

   let _guard = balance_update_guard(args.owner.unwrap_or(caller))?;

   let caller_account = Account {
       owner: PrincipalId::from(args.owner.unwrap_or(caller)),
       subaccount: args.subaccount,
   };

   let address = state::read_state(|s| {
       // Convert the ckBTC address to a BTC one
       get_btc_address::account_to_p2wpkh_address_from_state(s, &caller_account)
   });

   let min_confirmations = state::read_state(|s| s.min_confirmations);

   let utxos = get_utxos(btc_network, &address, min_confirmations)
       .await?
       .utxos;
{% endhighlight %}

{% highlight tla %}
process ( Update_Balance \in UPDATE_BALANCE_PROCESS_IDS) 
    \* Argument of the call; start with a fixed address to reduce the state space
    variable caller_account = MINTER_BTC_ADDRESS,
             new_utxos = {};
    
{
Update_Balance_Start:
    \* Non-deterministically pick a value for the argument
    with(param_address \in CK_BTC_ADDRESSES) {
        caller_account := param_address;
        await(param_address.owner \notin locks);
        \* locks := locks \union {caller_account.owner};
        send_minter_to_btc_canister_get_utxos(self, caller_account);
    };
{% endhighlight %}

Let’s unpack this:

1.  We start the model of the method by declaring its local variables
    (`\*` denotes a line comment in TLA+). After declaring the
    variables, we define the `Update_Balance_Start` block which models
    the first message handler of the Rust implementation.

2.  In the Rust implementation, the address whose balance should be
    updated can be passed as a parameter or is otherwise set to the
    caller (`args.owner.unwrap_or(caller)`). In the PlusCal model, we
    instead have a set of `CK_BTC_ADDRESSES` (definition not shown here,
    but it’s the same as how `INCREASE_PIDS` were defined for the counter
    PlusCal model) that contains all the addresses that we consider in
    the model. We then non-deterministically pick some address from
    this set (recall the with block from our counter example). Then,
    we store the value of this choice in the `caller_account` variable,
    just like the implementation does. We conveniently simplify
    addresses in the model as follows. In reality, we must translate
    every ckBTC address to a Bitcoin address. In the model, we
    simplify this by identifying ckBTC addresses with a subset of
    Bitcoin addresses, without having to do the translation – so we
    just use the caller_acount instead of address for the get_utxos
    request.

3.  We then use an `await` PlusCal statement. In a rather unfortunate
    unfolding of events in our universe, the PlusCal and the
    Rust/Motoko authors decided to use the same keyword for quite
    different concepts. In PlusCal, `await` denotes a condition on the
    predecessor state in the transition predicate. This means that
    only if the condition in the await is true in a given state, the
    transition is possible. In the example, the `Update_Balance_Start`
    block can only be executed in states where `param_address.owner` is
    *not* in the set of `locks`. Otherwise, the transition corresponding
    to this block isn’t possible. Recall that our transition predicate
    will generally be a disjunction over a bunch of transitions, so
    the system is free to take a different transition, but not this
    particular one.
    OK, but you’re now probably wondering what this `locks` set is and
    how it models the implementation. First, `locks` is a global
    variable in the model, modeling a piece of the canister’s global
    memory. I didn’t show its declaration here; it’s declared in a
    global variables block preceding the `Update_Balance process`, just
    like the `cnt` variable was declared in our counter model. We use
    `locks` to model the following line from the implementation  

    `let _guard = balance_update_guard(args.owner.unwrap_or(caller))?;`

    Essentially, this check prevents us from concurrently executing two
    update_balance calls for the same principal. The balance_update_guard
    function (whose definition is omitted here) implements a bare-bones
    mutex: it checks whether the given principal is in some stored set. If
    the principal is in the set the guard fails, and the update_balance
    method returns with an error. Note that, at this point, the canister
    state itself has not changed at all – as far as the canister state is
    concerned, it’s as if we haven’t executed the method at all. If the
    principal is not in the set, the guard succeeds, the principal is
    inserted in the set, and the execution continues. In the model, we
    achieve the same effect using the locks set. Since, as noted, the
    failure of the implementation guard is equivalent to the method not
    having executed in the first place, we can model this with a PlusCal
    await. An await will prevent the process from executing if the
    principal is in the locks set.  
    Recall that at the start of the post, we fixed the error trace by
    uncommenting the line adding the owner to the locks set. Hopefully now
    you understand how this prevents the attack from the [introductory
    post](https://medium.com/dfinity/eliminating-smart-contract-bugs-with-tla-e986aeb6da24)!

1.  The Update_Balance_Start block then finishes off by sending a
    `get_utxos` message to the Bitcoin canister, just like the
    implementation does.

Before we proceed with the second message handler, let’s look at the
PlusCal model of sending the `get_utxos` request more closely, as modeling
inter-canister messaging is a crucial aspect of applying TLA+ to
canisters. Furthermore, we’ll look at how we model the processing of the
request at the recipient, the Bitcoin canister, to get a feeling for how
to model the environment of the target canister (the ckBTC minter in
this case). Here’s the definition of
`send_minter_to_btc_canister_get_utxos`, which is a PlusCal macro that,
exactly like macros in the C language, is replaced by its definition
whenever it’s called.

{% highlight tla %}
Get_Utxos_Request(caller_id, btc_address) == [
    caller_id |-> caller_id,
    type |-> "get_utxos",
    address |-> btc_address
]
macro send_minter_to_btc_canister_get_utxos(caller_id, address) {
    minter_to_btc_canister := Append(minter_to_btc_canister, 
        Get_Utxos_Request(caller_id, address));
}
{% endhighlight %}

First, there’s an auxiliary definition called `Get_Utxos_Request`, which
creates a record describing the message that’s sent from the minter to
the Bitcoin canister<sup>[^4]</sup>. Then, the macro appends the (record
describing the) message to the end of `minter_to_btc_canister`, which is a
global variable (as with other global variables, I’ll omit the
definition here) containing the (initially empty) sequence of messages
currently in-flight from the minter to the Bitcoin canister. In
`Update_Balance_Start`, we use the keyword `self` for the caller ID, which
gets replaced by the ID of the current PlusCal process. This will allow
us to match the eventual responses with the corresponding requests – the
IC does the same kind of bookkeeping internally, by attaching a
so-called [call
context](https://internetcomputer.org/docs/current/references/ic-interface-spec#call-contexts)
to every request.

<span id="bitcoin-canister-process"></span>

The message is going to be picked up by the [Bitcoin
canister](https://github.com/dfinity/bitcoin-canister), which we model
as yet another PlusCal process.

{% highlight tla %}
process ( BTC_Canister = BTC_CANISTER_PROCESS_ID)
{
BTC_Canister_Loop:
while(TRUE) {
 either {
   \* Ingest the current BTC network status
   btc_canister := btc;
 } or {
   \* Process a message from the minter
   await(minter_to_btc_canister # <<>>);
   with(req = Head(minter_to_btc_canister)) {
     minter_to_btc_canister := Tail(minter_to_btc_canister);
     either {
       \* Process a get_utxos request
       if(Is_Get_Utxos_Request(req)) {
         with(addr = Get_Utxos_Request_Address(req)) {
             respond_btc_canister_to_minter_utxos(Caller(req),
                 Utxos_Owned_By(btc_canister, {addr}));
         }
       } else {
         \* Handle other kind of requests
         …
       }
     } or {
       \* Non-deterministically choose to respond with an error, regardless of what
       \* the request was
       respond_btc_canister_to_minter_err(Caller(req))
     }
   }
 }
}
};
{% endhighlight %}

There’s quite a bit to unpack here. First, we model the Bitcoin canister
as one big infinite while loop. Since we have only one label, PlusCal
treats every iteration of the loop as being executed atomically - this
suffices for us since we’re not interested in modeling the details of
the Bitcoin canister.  
In the loop, we start with an `either` statement, which intuitively
non-deterministically picks between any of the enabled or-branches;
PlusCal translates either into a TLA+ disjunction, just like the TLA+
model that we wrote by hand in the [counter increment
example](#increment-example). First, the canister takes
the choice between ingesting the latest UTXOs from the Bitcoin network
or responding to messages. The former is done by copying the global `btc`
variable to the global `btc_canister` variable; there’s yet another
PlusCal process, not shown here, that models Bitcoin network and changes
this variable. Responding to messages is only possible if there is an
in-flight message in the first place, i.e., `minter_to_btc_canister` must
be different (written as `#`) from the empty sequence (written as
`<<>>`). If so, we take the first request (at the head of the
sequence), change the sequence to its tail (i.e., drop the first
element), and then do another non-deterministic choice. The first option
is to do the actual processing of the message; here, we’re showing only
the case of a `get_utxos` request, where we respond to the caller with the
UTXOs owned by the address passed in the request. The second option is
to just respond with an error, for no particular reason. On the IC, this
can always happen, as the system doesn’t guarantee that the messages are
delivered to the callee (e.g., the IC may reject requests on its own
when it’s under load). Both responses are again implemented as macros,
for example the first one being:

{% highlight tla %}
macro respond_btc_canister_to_minter_ok(caller_id) {
   btc_canister_to_minter := btc_canister_to_minter \union {
       [ caller_id |-> caller_id,
         status |-> Status_Ok
       ]
   };
}
{% endhighlight %}

Do you notice the difference between this and how we used
`minter_to_btc_canister` before? Here, `btc_canister_to_minter` is a *set*,
i.e., an unordered buffer of messages, and we insert the response into
this set. This is because, unlike for *requests*, the IC provides no
guarantees on the order in which *responses* are received.

The next PlusCal block models the second message handler of the
`update_balance` method of the minter canister. This handler processes the
UTXOs received from the Bitcoin canister and instructs the ckBTC ledger
to mint ckBTC corresponding to “new” UTXOs, not previously processed by
the minter.

{% highlight rust %}
   let utxos = get_utxos(btc_network, &address, min_confirmations)
       .await?
       .utxos;

   let new_utxos: Vec<_> = state::read_state(|s| {
       let existing_utxos = s
           .utxos_state_addresses
           .get(&caller_account)
           .unwrap_or(&BTreeSet::new());
       let finalized_utxos = s
           .finalized_utxos
           .get(&caller_account.owner)
           .unwrap_or(&BTreeSet::new());
       BTreeSet::from_iter(new_utxos)
           .difference(&existing_utxos.union(finalized_utxos))
           .collect()
   });

   // Remove pending finalized transactions for the affected principal.
   state::mutate_state(|s| s.finalized_utxos.remove(&caller_account.owner));

   let satoshis_to_mint = new_utxos.iter().map(|u| u.value).sum::<u64>();

   if satoshis_to_mint == 0 {
       return Err(UpdateBalanceError::NoNewUtxos {
           required_confirmations: min_confirmations,
       });
   }

   let mint_txid = mint(satoshis_to_mint, caller_account.clone()).await?;
{% endhighlight %}

{% highlight tla %}
Update_Balance_Receive_Utxos:
   with(
     response \in { r \in btc_canister_to_minter: Caller(r) = self };
     status = Status(response)
   ) {
     btc_canister_to_minter := btc_canister_to_minter \ {response};
     if(Is_Ok(status)) {
       with(
         utxos = Get_Utxos_Result(response);
         nutxos = utxos \ (
           With_Default(utxos_states_addresses,caller_account,{})
           \union
           With_Default(finalized_utxos,caller_account.owner,{})
         );
         discovered_amount = Sum_Utxos(nutxos);
       ) {
         finalized_utxos := Remove_Argument(finalized_utxos,caller_account.owner);
         if(discovered_amount = 0) {
           return_from_update_balance();
         } else {
           send_minter_to_ledger_mint(self, caller_account, discovered_amount);
           new_utxos := nutxos;
         }
       }
     } else {
       \* If the call fails, release the lock and finish
       return_from_update_balance();
     }
   };
{% endhighlight %}

Again let’s look at this step-by-step:

1.  The first few lines of PlusCal model the receipt of the response to
    the `get_utxos` request sent to the Bitcoin canister by the first
    message handler. This is similar to how we modeled the receipt of
    the corresponding request by Bitcoin canister, except that we’re
    now dealing with a set rather than a sequence. We first pick a
    response that’s targeted at the current process (i.e., the caller
    is `self`). While the with statement normally represents
    non-deterministic choice, in this case there will only be one
    request that fulfills our criterion so there’s no real
    non-determinism. However, conveniently, the PlusCal with statement
    is only executable when the set that’s being picked from (in this
    case, the set of responses for self) is non-empty. In other words,
    the block containing the with statement can’t execute for as long
    as the set stays empty. This works well to model the Rust await in
    a Rust message handler, as this can only execute once a response
    arrives. When a response is available, we remove it from the
    `btc_canister_to_minter` set since we are now processing it it, and
    branch on the status of the response.

2.  If the response is not an error, modeled by `Is_Ok(status)`, we do the
    same computation as the implementation, just using PlusCal. We
    define several convenience operators for this purpose, such as
    `With_Default` which is similar to Rust’s `unwrap_or`. We determine
    which UTXOs are “newly discovered”, as in, they have not been
    processed by the minter before.

3.  If these newly discovered UTXOs sum up to 0 (which is to say,
    there are no new UTXOs), there’s nothing to mint; in this case, the
    implementation executes return. This return has the side-effect of
    dropping the `_guard` variable. We model the effect of this by removing 
    the corresponding entry from the `locks` set.
    Moreover, instead of finishing the process instance, we use `goto` to
    jump back to the start of the process. This is essentially a
    hand-written loop. Going back to the start of the loop allows us to
    “recycle” the same process instance to serve a new `update_balance`
    method call, where each iteration of the loop serves one method call.
    In this way, each `Update_Balance` process instance models an infinite
    number of *sequential* calls to update_balance. Multiple
    `Update_Balance` process instances model can also model *concurrent*
    calls.

    Before going back to start, we also reset the local variables to their
    initial values. All of this is implemented by the following macro:  
    ```
    macro return_from_update_balance() {
      locks := locks \ {caller_account.owner};
      caller_account := MINTER_BTC_ADDRESS;
      new_utxos := {};
      goto Update_Balance_Start;
    }
    ```
1.  If the newly discovered UTXOs don’t sum up to 0 (the `else` branch),
    we’ll send a corresponding mint message to the ckBTC ledger
    canister. This is modeled analogously to sending a message to the
    Bitcoin canister, where we append an element to a global variable
    containing the in-flight messages from the ckBTC minter to the
    ckBTC ledger.

2.  If the response from the Bitcoin canister is an error response, the
    implementation stops executing the `update_balance` method. The `?`
    operator in the `get_utxos(..).await?` statement behaves exactly
    like a return and returns the error. We model this by reusing the
    same macro as in the case where no new UTXOs have been discovered.
    The PlusCal model omits the interaction with the user, so it
    doesn’t return errors.

Finally, the last block of the `Update_Balance` process models the
method’s third message handler.

{% highlight rust %}
  let mint_txid = mint(satoshis_to_mint, caller_account.clone()).await?;


   state::mutate_state(|s| state::audit::add_utxos(s, Some(mint_txid), 
      caller_account, new_utxos));


   Ok(UpdateBalanceResult {
       amount: satoshis_to_mint,
       block_index: mint_txid,
   })
}
{% endhighlight %}

{% highlight tla %}
Update_Balance_Mark_Minted:
   with(response \in { r \in ledger_to_minter: Caller(r) = self};
           status = Status(response);
       ) {
       ledger_to_minter := ledger_to_minter \ {response};
       if(Is_Ok(status)) {
           available_utxos := available_utxos \union new_utxos;
           utxos_states_addresses :=
               caller_account :> (
                   With_Default(utxos_states_addresses, caller_account, {})
                   \union new_utxos
               ) @@ utxos_states_addresses;
       };
   };
   \* Regardless of whether the call to the minter succeeds, release the lock
   return_from_update_balance();
};
{% endhighlight %}

Most of this should be familiar by now:

1.  We use the `with` statement to block until a ledger response to this
    process is available. We then remove the response from the buffer
    of in-flight responses and continue to process it.

2.  If the response is a success, we model the change performed by
    [add_utxos](https://github.com/dfinity/ic/blob/24147debbe62230993ca74d171337c4c4430ad1c/rs/bitcoin/ckbtc/minter/src/state/audit.rs#L16).
    The TLA+ pattern

    `k :\> v @@ M`

    is used to model setting the value of a key `k` to a value `v` in a
    map `M` (overwriting any previous value).

3.  Regardless of whether the response was a success, we return from the
    method, dropping the lock and resetting the local variables as
    before.

This concludes our model of `update_balance`. Once we have completed the
model, we want to analyze it. For this, we want to check some properties
of the model. Let’s see how to do that.

<span id="anchor-9"></span>
# TLA+ Properties

The simplest – and often the most useful! – kinds of properties that
TLA+ tools can check are the *invariant* properties. These are
predicates (Boolean functions) on individual states, which we expect to
hold for *all* states that our system can get into. The main ckBTC
property, that we don’t mint unbacked ckBTC, is in fact an invariant. To
see how this property is specified in TLA+, let’s take a quick look at
one piece of the model that we haven’t seen so far, namely how the ckBTC
ledger handles the minter’s request to mint ckBTC. I’ll focus on the
part relevant for our property.

{% highlight tla %}
process (Ledger = LEDGER_PROCESS_ID)
{
Ledger_Loop:
 while(TRUE) {
   either {
     \* A request by the minter canister
     await(minter_to_ledger # <<>>);
     with(req = Head(minter_to_ledger)) {
       minter_to_ledger := Tail(minter_to_ledger);
       either {
         if(Is_Mint_Request(req)) {
           balance := req.to :> (With_Default(balance, req.to, 0) + req.amount)
               @@ balance;
           respond_ledger_to_minter_ok(req.caller_id);
         } else {
           \* Other types of requests
           …
         }
       } or {
           \* Non-deterministically choose to send an error response
           respond_ledger_to_minter_err(req.caller_id);
       };
     }
   }
   or {
     \* A user-initiated transaction of ckBTC
     …
   }
 }
}
{% endhighlight %}

This process’s structure is very similar to the Bitcoin canister process
that we [saw earlier](#bitcoin-canister-process), with a
top-level infinite while loop, and a non-deterministic choice
(either/or) between different processing actions. The interesting part
is the successful processing of a mint request, which includes changing
the ckBTC balances:

`balance := req.to :> (With_Default(balance, req.to, 0) + req.amount) @@ balance;`

This uses the map update pattern seen earlier, which increases the
balance of the `req.to` account by `req.amount`.

As stated earlier, the most important invariant of our system is that we
don’t want *unbacked* ckBTC. That is, we don’t want to have more ckBTC
in circulation than the sum of the amounts of actual Bitcoin that are
controlled by some ckBTC address. Translating this to our model, the
supply of ckBTC, which is the sum over all values of the `balance` map,
must be less than or equal to the amount of Bitcoin UTXOs (which, as
we’ve briefly seen, is modeled by the `btc` variable) that are controlled
by a ckBTC address. This is captured by the following TLA+ predicate:

{% highlight tla %}
BTC_Balance_Of(addresses) == Sum_Utxos(Utxos_Owned_By(btc, addresses))
Inv_No_Unbacked_Ck_BTC ==
   Sum_F(LAMBDA x: balance[x], DOMAIN balance) 
   <= 
   Sum_Utxos(Utxos_Owned_By(btc, CK_BTC_ADDRESSES \union {MINTER_BTC_ADDRESS}))
{% endhighlight %}

The `DOMAIN` operator lists all keys of the `balance` map, that is, all
ckBTC accounts that have a balance. The `Sum_F` operator then computes the
sum of the corresponding values in the `balance` map, that is, the amounts
held by the accounts. We want this to be less or equal to the BTC
balance of all ckBTC addresses together with the special minter address
(which is only used when withdrawing BTC, which we haven’t covered in
this post). This is the invariant that you saw violated in the error
trace from the beginning of this post.

While you should get very good mileage from invariant properties, TLA+
tools can check a large range of other properties too, the so-called
*temporal* properties. These properties can be substantially more
complicated to state than invariants. For example, we would intuitively
want the ckBTC supply to be exactly equal to the amount of Bitcoin
controlled by a ckBTC address, as we stated earlier, instead of being
smaller or equal. However, we can’t require this to always hold, since
minting ckBTC requires the user to first deposit Bitcoin, and only then
can we increase the ckBTC supply. But what we can ask is that the ckBTC
supply eventually reaches the amount of Bitcoin controlled by a ckBTC
address. This guarantees that we don’t “lose” the deposited Bitcoin,
which would be equally bad as unbacked ckBTC from a user perspective.
However, this property only holds under certain conditions. For example:

1.  If ckBTC charges fees for its operations, then the supply of ckBTC
    (available to the users) is indeed expected to stay lower than the
    Bitcoin supply. In our model, we must ignore the fees (i.e., act
    as if they were 0).

2.  If users never notify the minter that they have deposited ckBTC,
    then the minter won’t instruct the ledger to mint the
    corresponding ckBTC and increase the ckBTC supply, breaking our
    property. Thus, we have to condition our desired property on
    `update_balance` being called sufficiently often.

3.  A bit less obviously, in theory the calls from the minter to the
    ledger could always fail, which would prevent us from increasing
    the supply of ckBTC. Thus, the property also has to be conditioned
    on inter-canister calls eventually receiving a response that’s not
    a system error.

There are actually even more such conditions. I won’t list all of them
here – you can find them all in the `Liveness_Spec` definition in the
model. In particular, conditions 2 and 3 above are examples of so-called
*fairness* conditions, which are often needed for temporal properties.
The “Learn TLA+” book provides a useful section on [temporal
properties](https://learntla.com/core/temporal-logic.html), including
fairness conditions.

**TLDR**: TLA+ tools support both checking invariants and other kinds of
temporal properties. General (non-invariant) temporal properties are
often much more cumbersome to state, and usually require fairness
conditions. Invariants should be sufficient for many applications and
you should start from those, but general temporal properties can also be
useful.

Once you have specified the properties, the next step is to analyze
them. At the start of the post you’ve already gotten a taste of what the
final step of this looks like in practice.

<span id="anchor-10"></span>
# TLA+ Analysis in Practice

The first thing you need to do is choose which tool you want to use to
analyze your TLA+ models. You have three choices:

1.  TLC, which comes bundled with the TLA+ tools (both with the VSCode
    extension and with the official TLA+ Toolbox)

2.  [Apalache](https://apalache.informal.systems/), which you have to
    download separately.

3.  TLAPS, which also comes bundled with the TLA+ Toolbox.

The tools have different focuses, strengths, and limitations, but I
heartily recommend you to start with the simplest and most widely used
one, TLC. As you’ve already experienced, TLC is a “push button” tool.
That is, after you create your model and the specifications, you let TLC
analyze a model while you go and have a coffee. However, depending on
the model, the coffee might turn into a lunch, or even a holiday, as the
analysis may take weeks or even months to finish. In that case you’ll
have to revisit your model to make it work better with TLC, or consider
using one of the other two tools.

When running or preparing an analysis, it’s helpful to understand how
TLC works. The basic idea is rather crude: TLC just exhaustively
enumerates all (!) the states of your model. It first looks at your
initial predicate to find all states that satisfy the predicate. For
this to work, the number of initial states must be finite, i.e., your
initial predicate must only be satisfiable by a finite number of states.
For example, going back to our counter model, if we specified the
initial predicate as:

`Init == cnt \in Nat`

which is perfectly valid TLA+, TLC will complain that it can’t enumerate
an infinite set. That is, TLC only supports a subset of TLA+. This is
also true of Apalache and TLAPS, though they all support different
subsets. The subset supported by TLC is documented in the [TLA+ book
Specifying Systems](https://lamport.azurewebsites.net/tla/book.html).

What’s trickier is that your transition relation may give rise to an
infinite number of states. For example, our counter model has an
infinite number of states. Yet, TLC is not smart enough to detect this,
and will happily try to analyze it for whatever property you state for
this model – of course, it will eventually just crash after it exhausts
the memory (or disk) of your system trying to store an infinite number
of states. So you have to manually ensure that your model defines only a
finite number of reachable states. In practice, this usually isn’t as
difficult as it sounds – usually it’s enough to stop and think any time
you increment a counter, append an element to a list, or insert an
element in a set, and somehow introduce a bound that prevents the
counter/list/set from growing unboundedly. For example, we can rewrite
the counter model as follows.

{% highlight tla %}
---- MODULE Counter_Finite ----
EXTENDS Naturals

LIMIT == 100

VARIABLE cnt

Init == cnt = 0

Next ==
   \/
       /\ cnt < LIMIT
       /\ cnt' = cnt + 1
   \/
       /\ cnt >= LIMIT
       /\ cnt' = cnt
====
{% endhighlight %}

That is, we explicitly limit how high our counters can get. We also make
`Next` more complicated here; it’s now a disjunction, where we ask that
either `cnt` be below the limit and increase by 1 in the next state, or
that `cnt` be at or above the limit and stay the same in the next state.
If we remove the second disjunct and run the analysis, TLC will point
out a problem with our spec. Namely, it will complain that our model can
*deadlock*: when `cnt` reaches `LIMIT`, we can no longer perform any
transitions. With the second disjunct in place, we can move from the
state where `cnt` is `LIMIT` to that same state. You can turn
deadlock checking off, but it’s usually useful to keep it on, as it can
point us to potential problems in the model.

The `LIMIT` above is an example of a model *parameter*, which we can tune
to increase or decrease the size of the model. You will almost always
use parameters in your models. An increasing model size means an
increasing TLC analysis time. With parameters, you can easily experiment
to find a model size that gives you a high confidence in your system,
but still yields a reasonable running time. The usual approach is to
start with the smallest reasonable parameters, and then, if no issues
are found in the analysis, increase the parameters until the analysis
time gets unreasonable.

For example, for our model of ckBTC, we define a bunch of parameters,
such as:

1.  The set `UPDATE_BALANCE_PROCESS_IDS`. The size of this set determines
    how many concurrent `Update_Balance` process instances we analyze in
    our model. Recall that each `Update_Balance` process instance
    corresponds to a call to the `update_balance` method in the
    implementation. In practice, the number of these concurrent calls
    needn’t be bounded by any concrete bound (other than exhausting
    the capacity of the IC), but we have to invent such a bound for
    the model. We run the analysis with two instances; while this is a
    very small number, we have not yet found (using manual analysis)
    any attacks on ckBTC which would require more than two concurrent
    calls to `update_balance`, and increasing the number of concurrent
    calls further dramatically increases the search space.

2.  The set of all principals (IC “user IDs”). In practice, the length
    of a user ID is bounded to 29 bytes, but this is a humongous
    number of IDs, and we would not want to enumerate all them (which
    is what TLC would happily run off to do). In the analysis, we
    limit ourselves to a handful of principals. Similar to the number
    of concurrent calls, we have not yet found any attacks which rely
    on a huge number of participants.

3.  The number of total Bitcoin transactions allowed. Every Bitcoin
    transaction in the model generates a new transaction identifier,
    leading to an infinite (or at least huge) number of such
    identifiers, and thus states.

Instead of spelling out the value of these parameters directly in the
model, we usually define them as TLA+ constants. For example, we could
define `LIMIT` as just:

{% highlight tla %}
CONSTANTS
   LIMIT
{% endhighlight %}

The resulting model is complete from the TLA+ perspective, but to
analyze the model using TLC, we have to later choose a concrete limit in
a TLC configuration file. In fact, TLC requires this file to run the
analysis in the first place; you can have a look at `Ck_BTC.cfg` in the
example repo to see our choices. Separating the configuration from the
model allows one to leverage multiple configuration files, for example
to choose different parameters when analyzing different properties if
needed. By default, the VSCode extension will analyze a `Model.tla` file
using the `Model.cfg` file in the same directory (if it exists), but
there’s also a command (accessible from the VSCode command palette) to
check the model using a non-default config.

Additionally, the configuration file can instruct TLC to perform an
important analysis optimization called the *symmetry reduction*. I won’t
go into details here, but this optimization allows a much faster
analysis of the invariant properties of the model; the “Learn TLA+” book
provides [more
details](https://learntla.com/core/constants.html?highlight=symmetry)
on this.

**TLDR**. While there are multiple analysis tools for TLA+, you’ll
probably want to start off using TLC. Using TLC requires you to (a) stay
within the TLC-supported subset of TLA+ when writing your model and (b)
ensure that your model is finite. You’ll almost always have to
parameterize your model to ensure that it’s finite. Tune the parameters
to achieve a satisfactory balance of confidence in your system and the
analysis time.

<span id="anchor-11"></span>
# The End

We’ve covered quite a bit of ground in this post, but you should now be
armed with enough knowledge to start your first TLA+ model of a
canister. I’ll finish with a consolidated list of resources you might
find useful:

1.  The [TLA+ cheat
    sheet](https://mbt.informal.systems/docs/tla_basics_tutorials/tla+cheatsheet.html)
    – gives a quick overview of the constructs of the language, very
    handy when writing a model.

2.  [TLA+ examples](https://github.com/tlaplus/Examples) – a large
    collection of specifications of all kinds of systems using TLA+.

3.  [TLA+ community
    modules](https://github.com/tlaplus/CommunityModules) – a
    “stdlib” for TLA+, a library of generally useful operations on
    sets, sequences, etc.

4.  [Learn TLA+](https://learntla.com/index.html) – a free online book
    on TLA+ by Hillel Wayne, written as a pragmatic guide to TLA+ for
    engineers.

5.  [Specifying
    Systems](https://lamport.azurewebsites.net/tla/book.html) – the
    TLA+ “Bible”, written by the author of TLA+, Leslie Lamport. A
    comprehensive guide to all things TLA+.

And of course, DFINITY's freshly [open-sourced repository](https://github.com/dfinity/tla-models/) of IC TLA+ models,
including several models of canisters!

# Footnotes

[^1]:  This is a slight simplification, as a handler can actually
    produce multiple requests instead of a single one. But most
    canisters – including ckBTC – don’t use this option. If your
    canisters do, you’ll need to generalize the presented strategy – if
    you understand the strategy in detail, it’ll be clear how.

[^2]:  This is a slightly simplified version of an older version of the
    production code.

[^3]:  More correctly, TLA+ traces also implicitly allow arbitrary
    repetition of states, so a sequence such as  
    s<sub>0</sub>, s<sub>0</sub>, s<sub>1, </sub>s<sub>1</sub>,
    s<sub>1</sub>, s<sub>1</sub>, s<sub>2</sub>, …  
    is also allowed. But this is a somewhat advanced technical point.

[^4]:  Get_Utxos_Request is actually a “pure” TLA+ definition, and not a
    PlusCal one. PlusCal doesn’t have its own expression language, it
    just relies on TLA+, and PlusCal code can refer to TLA+ definitions
    that come before the comment block containing the PlusCal algorithm
    keyword.
