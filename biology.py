from dataclasses import dataclass

import pandas as pd
import altair as alt

# Sequencing


@dataclass
class Seq:
    sample: str
    at: int
    data: str


@dataclass
class ReadCountMatrix1:
    @dataclass
    class M:
        sample: str
        at: int

    @dataclass
    class D:
        df: pd.DataFrame

    m: M
    d: D


@dataclass
class ReadCountMatrix2:
    @dataclass
    class M:
        sample1: str
        sample2: str
        at: int

    @dataclass
    class D:
        df: pd.DataFrame

    m: M
    d: D


def load_local_reads(
    seq: Seq,
) -> ReadCountMatrix1.D:
    df = ...
    return pd.DataFrame(df=df)


def aggregate_reads(
    rcm1: ReadCountMatrix1,
    rcm2: ReadCountMatrix1,
) -> ReadCountMatrix2.D:
    df = ...
    return pd.DataFrame(df=df)


# Transfection and growth


@dataclass
class Transfect:
    sample: str
    at: int
    library: str


@dataclass
class GrowthPhenotype:
    @dataclass
    class M:
        sample: str
        start: int
        end: int

    @dataclass
    class D:
        df: pd.DataFrame

    m: M
    d: D


def growth_phenotype(
    t: Transfect,
    rcm1: ReadCountMatrix1,
    rcm2: ReadCountMatrix1,
) -> GrowthPhenotype.D:
    df = ...
    return GrowthPhenotype.D(df=df)


# Bulk RNA-seq


@dataclass
class DifferentialGeneExpression:
    @dataclass
    class M:
        sample1: str
        sample2: str
        at: int

    @dataclass
    class D:
        df: pd.DataFrame

    m: M
    d: D


def combat_seq(
    rcm: ReadCountMatrix2,
) -> ReadCountMatrix2.D:
    df = ...
    return ReadCountMatrix2.D(df=df)


def deseq2(
    rcm: ReadCountMatrix2,
) -> DifferentialGeneExpression.D:
    df = ...
    return DifferentialGeneExpression.D(df=df)
