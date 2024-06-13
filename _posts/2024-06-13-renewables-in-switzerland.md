---
layout: post
title:  "Can Switzerland Transition to Renewables?"
date: 2024-06-13
comments: true
tag: Switzerland
tag: renewable energy
tag: energy supply
---

Taming climate change seems pretty important, but securing the energy, and in particular, electricity supply for a country is also a pretty big fricking deal. In Switzerland, these topics raise questions such as: Should we close our nuclear plants? Or should we build more of them? Should we build large solar installations in the Alps?

And in Switzerland, the people -- or at least the 75% of the population that hold Swiss passports -- get to [actually *vote*]( https://www.uvek.admin.ch/uvek/de/home/uvek/abstimmungen/vorlage-sichere-stromversorgung.html) on these questions. But I honestly don't know how to answer them. My only previous deeper dive into the topic was by the way of [Sustainable Energy Without the Hot Air](http://www.withouthotair.com/), but that's a bit dated by now, and specific to the UK rather than Switzerland. The Swiss media coverage tends to be "person X says we should do Y", but there's little further information on why should we believe any of them. So I was pretty happy to run into a [blog post](https://blogs.ethz.ch/energy/secure-renewable-switzerland/) from ETH Zurich that covers the topic. Unfortunately, the post itself was also rather of the "firm handshake and a confident smile" variety: yes, we can do it! Fortunately, the [report](https://ethz.ch/content/dam/ethz/special-interest/mavt/energy-science-center-dam/research/publications/ETH_Zurich_ESC_White_Paper_Energy_Security.pdf) that the post was based on is more informative, but not as helpful as I had hoped. I'll give my summary of it here so you can skip reading the whole thing.

# Conclusion

Let's start from the end: what does the report tell us about the big questions? Can we get rid of the nuclear plants, achieve net 0 emissions, and not mess up our electricity supply? Maybe. Do we need to install solar panels in the Alps? Maybe.

It would appear from the report that there's a rather awful lot of uncertainty. First, the predictions on how much electricity we will need by 2050 vary quite a lot. We'll need more to get to 0 emissions, but we don't know how much more. Second, the predictions on how much renewable electricity we can generate in the Alps also vary a lot.

Let's dig into it more.

# Yearly Demand and Supply in 2050

Let's first look at how much electricity we will need at a coarse, yearly level. In 2020, Switzerland used about 60 terawatt-hours (TWh) of electricity. For 2050, we'll need more if we want to get to 0 emissions, heating using heat pumps, and driving electric cars. The predictions from the report rely on [^marcucci-modelling-2023], with the following chart (taken verbatim from the paper, as all the other ones) predicting the electricity demand and supply.

![2050 electricity supply and demand predictions](/blog/assets/images/energy/yearly_supply_demand_2050.png)

Unfortunately, the report doesn't really explain what the scenarios are; they arise by choosing "with or without compensation abroad", and combining that with the choice of "high and low integration of Swiss and international energy markets". I also don't know which scenario is which in the graph, or why some models cover only one or two scenarios. I also have no idea what the differences between the models are. 

But what I *can* read from the graph is that, according to the models, demand could be anywhere between 75 and 110 TWh. This is quite a range; its size (35 TWh) is bigger than the difference between the lower end of the range and the current production (only 15 TWh difference). And combining the variances in the different demand categories would yield even larger ranges. "Mobility" (I guess transport of all sorts?) could take anywhere from 30 to 10 to... 0? TWh. And the "base", whatever that is, from 60 to 30 TWh.

On the supply side, the models that predict higher usage also predict higher supply. I'm not sure, but I suppose the idea is that we can somehow scale the production to meet the demand. For example, the different models seem to put solar anywhere between 20 and 50 TWh).

# Monthly Demand and Supply

Covering the yearly demand is a prerequisite, but we can't cover the electricity demands of January by producing electricity in July.
The report also provides this interesting graph of monthly demand and supply in 2020, sourced from the interesting [Swiss Energy Charts](https://energy-charts.info/index.html?l=en&c=CH).

![Monthly electricity demand and supply in 2020](/blog/assets/images/energy/usage_production_2020.png)

Already now, with a modest amount of heat pumps in Switzerland, the monthly demand in winter (December/January) exceeds the summer demand (June-August) by something like 20%. We rely on imports pretty much throughout the winter, with around 20% (1 TWh monthly) of the winter demand being imported. Unsurprisingly, there's a pretty dramatic difference in the solar output between summer and winter, both in Switzerland and the neighboring countries. Wind is much more stable, with more of it available in winter.

For 2050 predictions, the report provides a chart picked from the Nexus model; they don't say why they picked this model out of the whole bunch. I can only assume that the picture would look a lot different with the other models.

![Monthly electricity demand and supply in 2050](/blog/assets/images/energy/monthly_production_usage_2050.png)

According to this model, the winter demand in Switzerland is supposed to rise by around 1 TWh each month. The (inland) supply in the winter months would *drop* by around 1 TWh each month, due to the lack of nuclear power. Consequently, Swiss imports would grow during winter.

Europe-wide, the model predicts a huge increase in wind power supply, a decrease in nuclear supply, and an increase (!) in natural gas capacity, to the tune of producing 50 TWh a month in winter. The report doesn't describe at all how this fits with the 0 emission goal. I guess carbon capture of some sort?

The solar panels would make Switzerland produce more than it needs in the summer, and the paper assumes that the surplus would get exported. Neighboring countries would (according to the model, of course) be running a deficit in the summer given that there would be less wind. It's not quite clear to me why these countries wouldn't just install more solar panels of their own, though.

# Daily Demand and Supply

Daily variations in demand and supply are discussed only in passing. Unfortunately, no current data or predictions are provided; it's not at all discussed how much storage is or will be available/needed. Pumped hydropower is mentioned as the most important option, with batteries also being an "economically attractive solution".

# Economics

The costs of the transition to 0 emissions are estimates to be anywhere from negative, through 600 CHF per capita per year. Rooftop solar costs are estimated between 800-2800 CHF per kW (peak), with no estimates for systems installed in the mountains. New nuclear in Europe is estimated between 7600-12600 USD per kW, though just 2000 USD in Korea and 3200 in China, with European plants (Olkiluoto) taking 18 years to construct, compared to 7.5 years average worldwide. Extending the life of an existing reactor by 10 years is estimated to be around 1 billion CHF (though Beznau is supposed to be "just" 0.7 billion, and Leibstadt required 1 billion for the period 2010-2023).

# Politics

Obviously, the blackout scare of the winter 2022 made people and politicians consider energy independence, and the report makes multiple references to the war in the Ukraine. But another interesting point brought up by the report is that the EU has a "70% rule", whereby the EU member states must make at least 70% of their network capacity available for trade between EU member states. But Switzerland is not in the EU, and barring changes, the neighboring countries might have to shut down their trade with Switzerland at some point in order to comply with the 70% rule.

# Alpine Solar

Solar installations in the Alps are considered, though the authors appear to pull some number out of their behind here, quoting maximum annual supply figures between 45 TWh and 300 (!) TWh. Yet the figure of 300 TWh doesn't appear in either of the references ([^dujardin-2022], [^meyer-2023]) provided for these claims. The figures quoted in [^meyer-2023] are 45 TWh as a maximum "sensible" supply (as in not chopping forest down, or putting the panels in avalanche terrain). Using only "the most promising" locations would yield around 5 TWh annually, of which 2-3 TWh in the winter half of the year (it's not said how much would be produced in December and January in particular).

# Miscellanea

Air traffic in Switzerland is predicted to consume around 20-25 TWh (kerosene) in 2050. I'm not sure what I was expecting, but it kind of took me aback; it seems like a lot. With nearly everything else being electrified, and if we indeed end up using 80 TWh of electricity annually, that's 20% of total energy usage.


# Conclusion Again

For my money, the report doesn't provide very confident conclusions on how much energy we will need in 2050, nor where it will come from. My best guesses based on it are as follows:

1. It seems unlikely that Switzerland will be able to achieve energy independence with net 0 emissions without building out more nuclear power plants, even if we build a fair amount of alpine solar installations. And given the current attitude of the Swiss population towards nuclear power, it's also highly unlikely that there will be support for new nuclear any time soon, hence I suspect energy independence is not realistic.

2. Hence, some kind of electricity supply arrangement with the EU seems paramount.

3. This also means that Switzerland will be dependent on the EU having a sane energy policy, which, the way the EU is going, is a bit of a gamble. This suggests that keeping the existing Swiss nuclear reactors, in particular Gösgen and Leibstadt, running for as long as possible seems like a very sensible thing to do. Additionally, given the estimates of the energy transition cost, which seem to be 3-6 billion CHF a year, 100 millions a year for extending the plants' lifetimes seems like peanuts. It also seems viable politically; closing the plants doesn't seem to be particularly favored outside of the Greens and their supporters, currently a minority.

# References

[^marcucci-modelling-2023]: Marcucci, A., Guidati, G., Sanvito, F., Garrison, J., Panos, E., & Rüdisüli, M. CROSS model result comparison: Overview of modelling results. [link](https://sweet-cross.ch/wp-content/uploads/2023/02/2023_02_03_CROSS_Scenarios_Comparison.pdf)
 
[^dujardin-2022]: Dujardin, J., Schillinger, M., Kahl, A., Savelsberg, J., Schlecht, I., & Lordan-Perret, R. (2022). Optimized market value of alpine solar photovoltaic installations. [link](https://doi.org/10.1016/j.renene.2022.01.016)

[^meyer-2023]: Meyer, L., Weber, A.-K., & Remund, J. (2023). Das Potenzial der alpinen PV-Anlagen in der Schweiz. PV-Symposium Kloster Banz.[link](https://www.researchgate.net/profile/Jan-Remund/publication/369372494_Das_Potenzial_der_alpinen_PV-Anlagen_in_der_Schweiz/links/641851cb66f8522c38bd6136/Das-Potenzial-der-alpinen-PV-Anlagen-in-der-Schweiz.pdf)


