use crate::ir::*;

#[derive(Debug, Clone)]
pub enum Tree {
    Axiom(Fact),
    Goal(FactName),
    // Same as ComputationSignature, but:
    // (i) facts are instantiated
    // (ii) recursively references Tree
    Step {
        label: String,
        antecedents: Vec<(String, Tree)>,
        consequent: Fact,
        side_condition: Predicate,
    },
}

impl Tree {
    pub fn from_computation_signature(
        cs: &ComputationSignature,
        ret_args: Vec<(String, Value)>,
    ) -> Tree {
        Tree::Step {
            label: cs.name.clone(),
            antecedents: cs
                .params
                .iter()
                .filter_map(|(p, fact_name, _mode)| {
                    Some((p.clone(), Tree::Goal(fact_name.clone())))
                })
                .collect(),
            consequent: Fact {
                name: cs.ret.clone(),
                args: ret_args,
            },
            side_condition: cs.precondition.clone(),
        }
    }

    fn from_query(q: &Query) -> Option<Tree> {
        if !q.closed() {
            return None;
        }

        Some(Tree::Step {
            label: q.computation_signature.name.clone(),
            antecedents: q
                .computation_signature
                .params
                .iter()
                .map(|(n, f, _)| (n.clone(), Tree::Goal(f.clone())))
                .collect(),
            consequent: Fact {
                name: q.fact_signature.name.clone(),
                args: vec![],
            },
            side_condition: q.computation_signature.precondition.clone(),
        })
    }

    pub fn from_goal(top_level_goal: &Fact) -> Tree {
        Tree::from_query(&Query::from_fact(top_level_goal, "output")).unwrap()
    }

    pub fn replace(&self, path: &[String], subtree: &Tree) -> Tree {
        match path.first() {
            Some(name) => match self {
                Tree::Step {
                    label,
                    consequent,
                    side_condition,
                    antecedents,
                } => Tree::Step {
                    label: label.clone(),
                    consequent: consequent.clone(),
                    side_condition: side_condition.clone(),
                    antecedents: {
                        let mut ret = vec![];
                        let mut count = 0;
                        for (n, t) in antecedents {
                            if n == name {
                                ret.push((
                                    n.clone(),
                                    t.replace(&path[1..], subtree),
                                ));
                                count += 1;
                            } else {
                                ret.push((n.clone(), t.clone()));
                            }
                        }
                        if count == 0 {
                            panic!("Selector name not found: {}", name)
                        }
                        ret
                    },
                },
                _ => panic!("Path on non-step"),
            },
            None => subtree.clone(),
        }
    }

    pub fn add_side_condition(
        &self,
        path: &[String],
        additional_condition: &Predicate,
    ) -> Tree {
        match path.first() {
            Some(name) => match self {
                Tree::Step {
                    label,
                    antecedents,
                    consequent,
                    side_condition,
                } => Tree::Step {
                    label: label.clone(),
                    antecedents: antecedents
                        .iter()
                        .map(|(x, t)| {
                            if x == name {
                                (
                                    x.clone(),
                                    t.add_side_condition(
                                        &path[..path.len() - 1],
                                        additional_condition,
                                    ),
                                )
                            } else {
                                (x.clone(), t.clone())
                            }
                        })
                        .collect(),
                    consequent: consequent.clone(),
                    side_condition: side_condition.clone(),
                },
                _ => panic!("Invalid path for tree"),
            },
            None => match self {
                Tree::Step {
                    label,
                    antecedents,
                    consequent,
                    side_condition,
                } => Tree::Step {
                    label: label.clone(),
                    antecedents: antecedents.clone(),
                    consequent: consequent.clone(),
                    side_condition: side_condition
                        .iter()
                        .cloned()
                        .chain(additional_condition.clone())
                        .collect(),
                },
                _ => panic!("Invalid path for tree (ends in non-step)"),
            },
        }
    }

    pub fn queries(&self, lib: &Library) -> Vec<(Vec<String>, Query)> {
        match self {
            Tree::Step {
                antecedents,
                side_condition,
                consequent,
                ..
            } => {
                let mut goal_siblings = vec![];
                let mut ret = vec![];

                for (n, t) in antecedents {
                    match t {
                        Tree::Axiom(..) => (),
                        Tree::Goal(q) => {
                            goal_siblings.push((n.clone(), q.clone()))
                        }
                        Tree::Step { .. } => {
                            for (mut path, q) in t.queries(lib) {
                                // TODO: possibly inefficient
                                path.insert(0, n.clone());
                                ret.push((path, q))
                            }
                        }
                    }
                }

                if !goal_siblings.is_empty() {
                    ret.push((
                        vec![],
                        Query::free(
                            lib,
                            goal_siblings,
                            side_condition
                                .iter()
                                .map(|pr| {
                                    // TODO: probably don't need to substitute; just add more
                                    // equality constraints?
                                    pr.substitute_all(
                                        consequent
                                            .args
                                            .iter()
                                            .map(|(n, v)| {
                                                (n.as_str(), Query::RET, v)
                                            })
                                            .collect(),
                                    )
                                })
                                .collect(),
                        ),
                    ))
                };

                ret
            }
            _ => vec![],
        }
    }

    pub fn complete(&self) -> bool {
        match self {
            Tree::Axiom(_) => true,
            Tree::Goal(_) => false,
            Tree::Step { antecedents, .. } => {
                for (_, t) in antecedents {
                    if !t.complete() {
                        return false;
                    }
                }
                true
            }
        }
    }

    // pub fn head(&self) -> Option<&Fact> {
    //     match self {
    //         Tree::Axiom(f) => Some(f),
    //         Tree::Goal(_) => None,
    //         Tree::Step { consequent, .. } => Some(consequent),
    //     }
    // }

    pub fn postorder(&self) -> Vec<(Vec<String>, &Tree)> {
        let mut ret = vec![];
        match self {
            Tree::Axiom(..) | Tree::Goal(..) => (),
            Tree::Step { antecedents, .. } => {
                for (tag, t) in antecedents {
                    for (mut path, tt) in t.postorder() {
                        path.insert(0, tag.clone());
                        ret.push((path, tt));
                    }
                }
            }
        }
        ret.push((vec![], self));
        ret
    }

    fn make_dashes(amount: usize) -> String {
        std::iter::repeat('-').take(amount * 2).collect()
    }

    pub fn pretty(&self) -> termtree::Tree<String> {
        let mut gp = termtree::GlyphPalette::new();
        gp.item_indent = "─";
        gp.skip_indent = " ";

        use ansi_term::Color::*;
        gp.middle_item = Fixed(8).paint(gp.middle_item).to_string().leak();
        gp.last_item = Fixed(8).paint(gp.last_item).to_string().leak();
        gp.item_indent = Fixed(8).paint(gp.item_indent).to_string().leak();
        gp.middle_skip = Fixed(8).paint(gp.middle_skip).to_string().leak();
        gp.last_skip = Fixed(8).paint(gp.last_skip).to_string().leak();
        gp.skip_indent = Fixed(8).paint(gp.skip_indent).to_string().leak();

        match self {
            Tree::Step {
                consequent,
                antecedents,
                ..
            } if consequent.name == Query::GOAL_FACT_NAME
                && antecedents.len() == 1 =>
            {
                antecedents[0]
                    .1
                    .termtree(gp, &format!(".{}", antecedents[0].0))
            }
            _ => self.termtree(gp, ""),
        }
    }

    fn termtree(
        &self,
        gp: termtree::GlyphPalette,
        prefix: &str,
    ) -> termtree::Tree<String> {
        use crate::syntax::unparse;
        use ansi_term::Color::*;

        // termtree::Tree::new(Red.paint("hi!"))
        match self {
            Tree::Axiom(fact) => termtree::Tree::new(format!(
                "{} {} {} {}",
                Purple.paint("•"),
                Blue.paint(prefix),
                Purple.paint("[fact]"),
                Fixed(8).paint(unparse::fact(fact))
            ))
            .with_glyphs(gp),
            Tree::Goal(fact_name) => termtree::Tree::new(format!(
                "{} {} {} {}{}{}",
                Yellow.paint("•"),
                Yellow.paint(prefix),
                Yellow.paint("[goal]"),
                Fixed(8).paint("("),
                Yellow.paint(fact_name),
                Fixed(8).paint(")"),
            ))
            .with_glyphs(gp),
            Tree::Step {
                label,
                antecedents,
                consequent,
                side_condition,
            } => {
                let mut t = termtree::Tree::new(format!(
                    "{} {} {} {}",
                    Green.paint("•"),
                    Blue.paint(prefix),
                    Green.paint(format!("[{}]", label)),
                    Fixed(8).paint(unparse::fact(consequent))
                ))
                .with_glyphs(gp);
                for (tag, subtree) in antecedents {
                    t.push(subtree.termtree(gp, &format!(".{}", tag)));
                }
                t
            }
        }
    }

    fn _fmt(
        &self,
        f: &mut std::fmt::Formatter<'_>,
        depth: usize,
        prefix: &str,
    ) -> std::fmt::Result {
        match self {
            Tree::Axiom(fact) => write!(
                f,
                "{} {}{} [&axiom]",
                Tree::make_dashes(depth),
                prefix,
                crate::syntax::unparse::fact(fact),
            ),
            Tree::Goal(fact_name) => write!(
                f,
                "{} {}*** {}",
                Tree::make_dashes(depth),
                prefix,
                fact_name
            ),
            Tree::Step {
                label,
                antecedents,
                consequent,
                side_condition,
            } => {
                write!(
                    f,
                    "{} {}{} [{}]",
                    Tree::make_dashes(depth),
                    prefix,
                    crate::syntax::unparse::fact(consequent),
                    label,
                    // crate::syntax::unparse::predicate(side_condition)
                    //     .replace("\n", ""),
                )?;
                for (n, t) in antecedents {
                    write!(f, "\n")?;
                    t._fmt(f, depth + 1, &format!("<{}>: ", n))?;
                }
                Ok(())
            }
        }
    }
}

impl std::fmt::Display for Tree {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self._fmt(f, 1, "")
    }
}
