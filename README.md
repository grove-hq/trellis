# Trellis

## Why every code base needs a trellis

Should outline the motivations here i.e. we want coding agents to have more and more autonomy including approving and merging PRs.  However there are certain important architectural areas where we want to make sure that a human ratifies the change.

Have a read of what I wrote here - https://grovehq.com/blog/software-factory about trellis.  Maybe talk about some of the motivating examples i.e. how some bugs are terrible to have in the code and we want to make them just not attainable.

### The Analogy

We need to talk about the analogy with a real trellis (and a pic may be nice here). We are growing a code base and we want to make sure that all code past a present grows according to the architecture (the frame).

## How trellis achieves this

We need to talk about how this code base does 2 things.

1.) It establishes the notion of a frame, certain files in the code base form part of the frame, which protects the architectural invariants.  And agents cannot make changes to them without a human ratification.  This is done via proof of presence.  We should also talk about a principle that what goes into the frame is the smallest amount of code to guarantee the frame.

Again a pic here may really help showing a small number of files being the frame and guaranteeing what happens in all the other files (past and present).

2.) A set of utilities and patterns for the common things you want to put into a frame.  These are for the common patterns that we have seen that help us protect authentication, authorization and multi-tenancy.

We should then setup a patterns doc folder, which may eventually link to the sample repo (or we may put samples in this repo, need to discuss).

## What Trellis does not do (bit of a disclaimer on security)

Trellis is just checking that a mechanism is present and reached the right way. It is not judging whether the mechanism is correct, that is up to you. Please please don’t assume you can adopt Trellis and your coding agents will produce secure code. Trellis helps you focus your attention on where it is needed most, but the architectural patterns required to make your coding agents produce the necessary code are unique to your code base and your application.  We have found manual review and red teaming are necessary to maintain your ever evolving frames which in turn maintain your ever evolving codebase.

## License

Apache-2.0. See [LICENSE](LICENSE).
